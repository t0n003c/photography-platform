import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/src/db/client";
import { collection, gallery, location, page, photo, product } from "@/src/db/schema";
import { collectPhotoIds, parseBlocks, type Block } from "@/src/lib/blocks";
import { absoluteUrl, SITE } from "@/src/lib/seo";

export type SeoSurfaceType =
  | "static"
  | "page"
  | "gallery"
  | "category"
  | "location"
  | "product";

export type SeoCheckStatus = "pass" | "warn" | "fail";

export interface SeoAuditCheck {
  key: string;
  label: string;
  status: SeoCheckStatus;
  message: string;
}

export interface SeoAuditUrl {
  id: string;
  type: SeoSurfaceType;
  label: string;
  path: string;
  url: string;
  editUrl: string | null;
  score: number;
  title: string | null;
  description: string | null;
  photoCount: number;
  missingAltCount: number;
  sitemapListed: boolean;
  checks: SeoAuditCheck[];
}

export interface SeoImageSample {
  id: string;
  filename: string;
  altText: string | null;
  headline: string | null;
  caption: string | null;
  usageCount: number;
}

export interface SeoAuditResponse {
  generatedAt: string;
  summary: {
    totalUrls: number;
    goodUrls: number;
    warningUrls: number;
    failingUrls: number;
    averageScore: number;
    sitemapListedUrls: number;
    publicPhotos: number;
    publicPhotosMissingAlt: number;
    imageAltCoverage: number;
  };
  urls: SeoAuditUrl[];
  imageAudit: {
    totalPublicPhotos: number;
    missingAlt: number;
    missingCaption: number;
    missingHeadline: number;
    samples: SeoImageSample[];
  };
  recommendations: string[];
}

interface UrlCandidate {
  id: string;
  type: SeoSurfaceType;
  label: string;
  path: string;
  editUrl: string | null;
  title: string | null;
  description: string | null;
  h1Count: number;
  bodyText: string;
  photoIds: string[];
  sitemapListed: boolean;
  structuredData: "yes" | "partial" | "missing";
}

interface EntityPhotoStats {
  id: string;
  photoCount: number;
  missingAltCount: number;
}

interface PublicPhotoStats {
  total: number;
  missingAlt: number;
  missingCaption: number;
  missingHeadline: number;
  samples: SeoImageSample[];
}

function clean(value?: string | null): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function blockText(blocks: Block[]): string {
  const chunks: string[] = [];
  const visit = (block: Block) => {
    if (block.hidden) return;
    if (block.type === "columns") {
      block.columns.flat().forEach(visit);
      return;
    }
    if ("text" in block && typeof block.text === "string") chunks.push(block.text);
    if ("headline" in block && typeof block.headline === "string")
      chunks.push(block.headline);
    if ("title" in block && typeof block.title === "string") chunks.push(block.title);
    if ("body" in block && typeof block.body === "string") chunks.push(block.body);
    if ("subhead" in block && typeof block.subhead === "string")
      chunks.push(block.subhead);
    if ("description" in block && typeof block.description === "string")
      chunks.push(block.description);
  };
  blocks.forEach(visit);
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

function h1Count(blocks: Block[]): number {
  let count = 0;
  const visit = (block: Block) => {
    if (block.hidden) return;
    if (block.type === "columns") {
      block.columns.flat().forEach(visit);
      return;
    }
    if (block.type === "heading" && block.level === 1) count += 1;
  };
  blocks.forEach(visit);
  return count;
}

function check(
  key: string,
  label: string,
  status: SeoCheckStatus,
  message: string,
): SeoAuditCheck {
  return { key, label, status, message };
}

function titleCheck(title: string | null): SeoAuditCheck {
  if (!title) return check("title", "Title", "fail", "Missing SEO title.");
  if (title.length < 10) {
    return check("title", "Title", "warn", "Title is very short.");
  }
  if (title.length > 65) {
    return check("title", "Title", "warn", "Title may be too long for search results.");
  }
  return check("title", "Title", "pass", "Title is present.");
}

function descriptionCheck(description: string | null): SeoAuditCheck {
  if (!description) {
    return check(
      "description",
      "Meta description",
      "fail",
      "Missing meta description.",
    );
  }
  if (description.length < 70) {
    return check(
      "description",
      "Meta description",
      "warn",
      "Description is short; add a useful search-result summary.",
    );
  }
  if (description.length > 180) {
    return check(
      "description",
      "Meta description",
      "warn",
      "Description is long; Google may rewrite it.",
    );
  }
  return check("description", "Meta description", "pass", "Description is present.");
}

function h1Check(count: number, type: SeoSurfaceType): SeoAuditCheck {
  if (count === 1) return check("h1", "H1", "pass", "One primary H1 signal found.");
  if (count > 1) {
    return check("h1", "H1", "warn", "Multiple H1 signals found.");
  }
  if (type === "page") {
    return check(
      "h1",
      "H1",
      "warn",
      "No explicit level-1 Heading block found. Some hero layouts may still render a visual H1.",
    );
  }
  return check("h1", "H1", "pass", "Template route renders a primary H1.");
}

function contentCheck(text: string, type: SeoSurfaceType): SeoAuditCheck {
  const words = wordCount(text);
  const minimum = type === "gallery" || type === "product" ? 25 : 40;
  if (words >= minimum) {
    return check("content", "Page copy", "pass", `${words} words of page copy found.`);
  }
  return check(
    "content",
    "Page copy",
    "warn",
    `${words} words found; add more specific client-facing copy.`,
  );
}

function imageCheck(photoCount: number, missingAltCount: number): SeoAuditCheck {
  if (photoCount === 0) {
    return check(
      "images",
      "Image context",
      "warn",
      "No public image references found.",
    );
  }
  if (missingAltCount === 0) {
    return check("images", "Image context", "pass", "Referenced images have alt text.");
  }
  const percent = Math.round(((photoCount - missingAltCount) / photoCount) * 100);
  return check(
    "images",
    "Image context",
    missingAltCount === photoCount ? "fail" : "warn",
    `${missingAltCount} of ${photoCount} referenced images are missing alt text (${percent}% coverage).`,
  );
}

function sitemapCheck(path: string, listed: boolean): SeoAuditCheck {
  if (listed)
    return check("sitemap", "Sitemap", "pass", "URL is represented in sitemap.");
  return check(
    "sitemap",
    "Sitemap",
    "fail",
    `${path} is indexable but not currently represented in sitemap.xml.`,
  );
}

function structuredDataCheck(value: UrlCandidate["structuredData"]): SeoAuditCheck {
  if (value === "yes") {
    return check("schema", "Structured data", "pass", "Structured data is present.");
  }
  if (value === "partial") {
    return check(
      "schema",
      "Structured data",
      "warn",
      "Some structured data is present; richer schema could improve search understanding.",
    );
  }
  return check(
    "schema",
    "Structured data",
    "warn",
    "No route-specific structured data is currently emitted.",
  );
}

function scoreChecks(checks: SeoAuditCheck[]): number {
  const score = checks.reduce((current, item) => {
    if (item.status === "fail") return current - 18;
    if (item.status === "warn") return current - 8;
    return current;
  }, 100);
  return Math.max(0, Math.min(100, score));
}

function urlFromPath(path: string) {
  return absoluteUrl(path);
}

async function pagePhotoStats(photoIds: string[]): Promise<EntityPhotoStats> {
  const ids = [...new Set(photoIds.filter(Boolean))];
  if (ids.length === 0) return { id: "page", photoCount: 0, missingAltCount: 0 };
  const rows = await db
    .select({
      id: photo.id,
      altText: photo.altText,
    })
    .from(photo)
    .where(and(inArray(photo.id, ids), isNull(photo.deletedAt)));
  return {
    id: "page",
    photoCount: rows.length,
    missingAltCount: rows.filter((row) => !clean(row.altText)).length,
  };
}

async function galleryPhotoStats(): Promise<Map<string, EntityPhotoStats>> {
  const rows = (await db.execute(sql`
    select
      g.id,
      count(distinct p.id)::int as "photoCount",
      count(distinct p.id) filter (
        where nullif(trim(coalesce(p.alt_text, '')), '') is null
      )::int as "missingAltCount"
    from gallery g
    left join gallery_photo gp on gp.gallery_id = g.id
    left join photo p on p.id = gp.photo_id
      and p.processing_status = 'ready'
      and p.deleted_at is null
    where g.visibility = 'public'
      and g.status = 'published'
      and g.deleted_at is null
    group by g.id
  `)) as unknown as EntityPhotoStats[];
  return new Map(rows.map((row) => [row.id, row]));
}

async function categoryPhotoStats(): Promise<Map<string, EntityPhotoStats>> {
  const rows = (await db.execute(sql`
    select
      c.id,
      count(distinct p.id)::int as "photoCount",
      count(distinct p.id) filter (
        where nullif(trim(coalesce(p.alt_text, '')), '') is null
      )::int as "missingAltCount"
    from collection c
    left join collection_photo cp on cp.collection_id = c.id
    left join photo p on p.id = cp.photo_id
      and p.processing_status = 'ready'
      and p.deleted_at is null
    where c.is_published = true
    group by c.id
  `)) as unknown as EntityPhotoStats[];
  return new Map(rows.map((row) => [row.id, row]));
}

async function locationPhotoStats(): Promise<Map<string, EntityPhotoStats>> {
  const rows = (await db.execute(sql`
    select
      l.id,
      count(distinct p.id)::int as "photoCount",
      count(distinct p.id) filter (
        where nullif(trim(coalesce(p.alt_text, '')), '') is null
      )::int as "missingAltCount"
    from location l
    left join photo_location pl on pl.location_id = l.id
    left join photo p on p.id = pl.photo_id
      and p.processing_status = 'ready'
      and p.deleted_at is null
    where l.is_published = true
    group by l.id
  `)) as unknown as EntityPhotoStats[];
  return new Map(rows.map((row) => [row.id, row]));
}

async function publicPhotoStats(): Promise<PublicPhotoStats> {
  const rows = (await db.execute(sql`
    with public_photo_ids as (
      select gp.photo_id as id from gallery_photo gp
      join gallery g on g.id = gp.gallery_id
      where g.visibility = 'public'
        and g.status = 'published'
        and g.deleted_at is null
      union
      select cp.photo_id as id from collection_photo cp
      join collection c on c.id = cp.collection_id
      where c.is_published = true
      union
      select pl.photo_id as id from photo_location pl
      join location l on l.id = pl.location_id
      where l.is_published = true
      union
      select pr.photo_id as id from product pr
      where pr.is_active = true and pr.photo_id is not null
    ),
    usage_counts as (
      select id, count(*)::int as "usageCount"
      from public_photo_ids
      group by id
    )
    select
      p.id,
      p.filename,
      p.alt_text as "altText",
      p.headline,
      p.caption,
      coalesce(u."usageCount", 0)::int as "usageCount"
    from usage_counts u
    join photo p on p.id = u.id
    where p.processing_status = 'ready'
      and p.deleted_at is null
    order by
      case when nullif(trim(coalesce(p.alt_text, '')), '') is null then 0 else 1 end,
      u."usageCount" desc,
      p.created_at desc
  `)) as unknown as SeoImageSample[];

  return {
    total: rows.length,
    missingAlt: rows.filter((row) => !clean(row.altText)).length,
    missingCaption: rows.filter((row) => !clean(row.caption)).length,
    missingHeadline: rows.filter((row) => !clean(row.headline)).length,
    samples: rows.filter((row) => !clean(row.altText)).slice(0, 12),
  };
}

export async function buildSeoAudit(): Promise<SeoAuditResponse> {
  const [
    pages,
    galleries,
    categories,
    locations,
    products,
    galleryStats,
    categoryStats,
    locationStats,
    imageStats,
  ] = await Promise.all([
    db
      .select()
      .from(page)
      .where(eq(page.status, "published"))
      .orderBy(asc(page.sortOrder), asc(page.title)),
    db
      .select()
      .from(gallery)
      .where(
        and(
          eq(gallery.visibility, "public"),
          eq(gallery.status, "published"),
          isNull(gallery.deletedAt),
        ),
      )
      .orderBy(desc(gallery.publishedAt), asc(gallery.title)),
    db
      .select()
      .from(collection)
      .where(eq(collection.isPublished, true))
      .orderBy(asc(collection.sortOrder), asc(collection.name)),
    db
      .select()
      .from(location)
      .where(eq(location.isPublished, true))
      .orderBy(asc(location.sortOrder), asc(location.name)),
    db
      .select()
      .from(product)
      .where(eq(product.isActive, true))
      .orderBy(asc(product.sortOrder), asc(product.name)),
    galleryPhotoStats(),
    categoryPhotoStats(),
    locationPhotoStats(),
    publicPhotoStats(),
  ]);

  const sitemapPaths = new Set<string>([
    "/",
    "/about",
    "/contact",
    "/categories",
    "/locations",
    ...categories.map((item) => `/categories/${item.slug}`),
    ...locations.map((item) => `/locations/${item.slug}`),
    ...galleries.map((item) => `/galleries/${item.slug}`),
  ]);

  const homePage = pages.find((item) => item.isHome);
  const candidates: UrlCandidate[] = [
    ...(homePage
      ? []
      : [
          {
            id: "static-home",
            type: "static" as const,
            label: "Home",
            path: "/",
            editUrl: "/admin/design",
            title: SITE.name,
            description: SITE.description,
            h1Count: 1,
            bodyText: SITE.description,
            photoIds: [],
            sitemapListed: sitemapPaths.has("/"),
            structuredData: "yes" as const,
          },
        ]),
    {
      id: "static-categories",
      type: "static",
      label: "Categories",
      path: "/categories",
      editUrl: "/admin/taxonomy",
      title: "Categories",
      description: "Browse the portfolio by category.",
      h1Count: 1,
      bodyText: "Browse the portfolio by category.",
      photoIds: [],
      sitemapListed: sitemapPaths.has("/categories"),
      structuredData: "missing",
    },
    {
      id: "static-locations",
      type: "static",
      label: "Locations",
      path: "/locations",
      editUrl: "/admin/taxonomy",
      title: "Locations",
      description: "Browse the portfolio by place.",
      h1Count: 1,
      bodyText: "Browse the portfolio by place.",
      photoIds: [],
      sitemapListed: sitemapPaths.has("/locations"),
      structuredData: "missing",
    },
    {
      id: "static-galleries",
      type: "static",
      label: "Galleries",
      path: "/galleries",
      editUrl: "/admin/galleries",
      title: "Galleries",
      description: "Browse public photo galleries.",
      h1Count: 1,
      bodyText: "Published stories and complete sets from recent work.",
      photoIds: [],
      sitemapListed: sitemapPaths.has("/galleries"),
      structuredData: "missing",
    },
    {
      id: "static-contact",
      type: "static",
      label: "Contact",
      path: "/contact",
      editUrl: "/admin/settings",
      title: "Contact",
      description: "Get in touch for bookings, print inquiries, and client galleries.",
      h1Count: 1,
      bodyText: "Get in touch for bookings, print inquiries, and client galleries.",
      photoIds: [],
      sitemapListed: sitemapPaths.has("/contact"),
      structuredData: "partial",
    },
  ];

  for (const item of pages) {
    if (item.slug === "about") continue;
    const blocks = parseBlocks(item.blocks);
    const path = item.isHome ? "/" : `/${item.slug}`;
    candidates.push({
      id: item.id,
      type: "page",
      label: item.isHome ? "Home page" : item.title,
      path,
      editUrl: `/admin/pages/${item.id}`,
      title: clean(item.seoTitle) ?? item.title,
      description: clean(item.seoDescription),
      h1Count: h1Count(blocks),
      bodyText: blockText(blocks),
      photoIds: collectPhotoIds(blocks),
      sitemapListed: sitemapPaths.has(path),
      structuredData: item.isHome ? "yes" : "missing",
    });
  }

  const about = pages.find((item) => item.slug === "about");
  if (about) {
    const blocks = parseBlocks(about.blocks);
    const path = "/about";
    candidates.push({
      id: about.id,
      type: "page",
      label: "About",
      path,
      editUrl: `/admin/pages/${about.id}`,
      title: clean(about.seoTitle) ?? about.title,
      description: clean(about.seoDescription),
      h1Count: h1Count(blocks),
      bodyText: blockText(blocks),
      photoIds: collectPhotoIds(blocks),
      sitemapListed: sitemapPaths.has(path),
      structuredData: "yes",
    });
  }

  for (const item of galleries) {
    const stats = galleryStats.get(item.id);
    candidates.push({
      id: item.id,
      type: "gallery",
      label: item.title,
      path: `/galleries/${item.slug}`,
      editUrl: `/admin/galleries/${item.id}`,
      title: item.title,
      description: clean(item.description),
      h1Count: 1,
      bodyText: [item.subtitle, item.description].filter(Boolean).join(" "),
      photoIds: [],
      sitemapListed: sitemapPaths.has(`/galleries/${item.slug}`),
      structuredData: "yes",
    });
    if (stats) galleryStats.set(item.id, stats);
  }

  for (const item of categories) {
    candidates.push({
      id: item.id,
      type: "category",
      label: item.name,
      path: `/categories/${item.slug}`,
      editUrl: `/admin/taxonomy`,
      title: item.name,
      description: clean(item.description),
      h1Count: 1,
      bodyText: item.description ?? "",
      photoIds: item.coverPhotoId ? [item.coverPhotoId] : [],
      sitemapListed: sitemapPaths.has(`/categories/${item.slug}`),
      structuredData: "yes",
    });
  }

  for (const item of locations) {
    candidates.push({
      id: item.id,
      type: "location",
      label: item.name,
      path: `/locations/${item.slug}`,
      editUrl: `/admin/taxonomy`,
      title: item.name,
      description: `Photography from ${item.name}${item.region ? `, ${item.region}` : ""}.`,
      h1Count: 1,
      bodyText: [item.name, item.region].filter(Boolean).join(" "),
      photoIds: item.coverPhotoId ? [item.coverPhotoId] : [],
      sitemapListed: sitemapPaths.has(`/locations/${item.slug}`),
      structuredData: "partial",
    });
  }

  for (const item of products) {
    candidates.push({
      id: item.id,
      type: "product",
      label: item.name,
      path: `/product/${item.slug}`,
      editUrl: `/admin/store`,
      title: item.name,
      description: clean(item.description),
      h1Count: 1,
      bodyText: [item.name, item.description, item.category, item.tags.join(" ")]
        .filter(Boolean)
        .join(" "),
      photoIds: item.photoId ? [item.photoId] : [],
      sitemapListed: sitemapPaths.has(`/product/${item.slug}`),
      structuredData: "missing",
    });
  }

  const pageStats = await Promise.all(
    candidates.map(async (candidate) => {
      if (candidate.type === "gallery") {
        return (
          galleryStats.get(candidate.id) ?? {
            id: candidate.id,
            photoCount: 0,
            missingAltCount: 0,
          }
        );
      }
      if (candidate.type === "category") {
        return (
          categoryStats.get(candidate.id) ?? {
            id: candidate.id,
            photoCount: candidate.photoIds.length,
            missingAltCount: 0,
          }
        );
      }
      if (candidate.type === "location") {
        return (
          locationStats.get(candidate.id) ?? {
            id: candidate.id,
            photoCount: candidate.photoIds.length,
            missingAltCount: 0,
          }
        );
      }
      return pagePhotoStats(candidate.photoIds);
    }),
  );

  const urls = candidates.map<SeoAuditUrl>((candidate, index) => {
    const stats = pageStats[index];
    const checks = [
      titleCheck(candidate.title),
      descriptionCheck(candidate.description),
      h1Check(candidate.h1Count, candidate.type),
      contentCheck(candidate.bodyText, candidate.type),
      imageCheck(stats.photoCount, stats.missingAltCount),
      sitemapCheck(candidate.path, candidate.sitemapListed),
      structuredDataCheck(candidate.structuredData),
    ];
    return {
      id: `${candidate.type}:${candidate.id}`,
      type: candidate.type,
      label: candidate.label,
      path: candidate.path,
      url: urlFromPath(candidate.path),
      editUrl: candidate.editUrl,
      score: scoreChecks(checks),
      title: candidate.title,
      description: candidate.description,
      photoCount: stats.photoCount,
      missingAltCount: stats.missingAltCount,
      sitemapListed: candidate.sitemapListed,
      checks,
    };
  });

  const titleCounts = new Map<string, number>();
  for (const row of urls) {
    if (!row.title) continue;
    const key = row.title.toLowerCase();
    titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
  }
  for (const row of urls) {
    if (!row.title) continue;
    const count = titleCounts.get(row.title.toLowerCase()) ?? 0;
    if (count <= 1) continue;
    row.checks.push(
      check("title-unique", "Unique title", "warn", "Title is reused by another URL."),
    );
    row.score = scoreChecks(row.checks);
  }

  const totalScore = urls.reduce((sum, row) => sum + row.score, 0);
  const publicPhotos = imageStats.total;
  const altCoverage =
    publicPhotos === 0
      ? 100
      : Math.round(((publicPhotos - imageStats.missingAlt) / publicPhotos) * 100);
  const recommendations: string[] = [];
  const missingSitemap = urls.filter((row) => !row.sitemapListed).length;
  const missingDescriptions = urls.filter(
    (row) => !row.description || row.description.length < 70,
  ).length;
  if (missingSitemap) {
    recommendations.push(
      `Add ${missingSitemap} indexable URL${missingSitemap === 1 ? "" : "s"} to sitemap.xml, especially builder pages and products.`,
    );
  }
  if (imageStats.missingAlt) {
    recommendations.push(
      `Write descriptive alt text for ${imageStats.missingAlt} public photo${imageStats.missingAlt === 1 ? "" : "s"}.`,
    );
  }
  if (missingDescriptions) {
    recommendations.push(
      `Improve short or missing meta descriptions on ${missingDescriptions} URL${missingDescriptions === 1 ? "" : "s"}.`,
    );
  }
  if (urls.some((row) => row.type === "product")) {
    recommendations.push(
      "Add Product structured data and product URLs to the sitemap for print-shop visibility.",
    );
  }
  if (!recommendations.length) {
    recommendations.push("No critical SEO content gaps found in this audit pass.");
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalUrls: urls.length,
      goodUrls: urls.filter((row) => row.score >= 85).length,
      warningUrls: urls.filter((row) => row.score >= 60 && row.score < 85).length,
      failingUrls: urls.filter((row) => row.score < 60).length,
      averageScore: urls.length ? Math.round(totalScore / urls.length) : 100,
      sitemapListedUrls: urls.filter((row) => row.sitemapListed).length,
      publicPhotos,
      publicPhotosMissingAlt: imageStats.missingAlt,
      imageAltCoverage: altCoverage,
    },
    urls: urls.sort((a, b) => a.score - b.score || a.path.localeCompare(b.path)),
    imageAudit: {
      totalPublicPhotos: publicPhotos,
      missingAlt: imageStats.missingAlt,
      missingCaption: imageStats.missingCaption,
      missingHeadline: imageStats.missingHeadline,
      samples: imageStats.samples,
    },
    recommendations,
  };
}
