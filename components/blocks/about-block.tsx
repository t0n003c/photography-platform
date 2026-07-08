import Link from "next/link";
import { Facebook, Instagram, Twitter } from "lucide-react";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { AboutContactForm } from "@/components/blocks/about-contact-form";
import { ToraAboutMeFit } from "@/components/blocks/tora-about-me-fit";
import type { PhotoDTO } from "@/src/db/queries/photos";
import type { LeafBlock } from "@/src/lib/blocks";
import { cn } from "@/src/lib/utils";

type AboutBlockData = Extract<LeafBlock, { type: "about" }>;

function paragraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function AboutButton({
  href,
  children,
  variant,
}: {
  href: string;
  children: React.ReactNode;
  variant: "line" | "outline";
}) {
  const className = variant === "line" ? "about-btn about-btn-line" : "about-btn about-btn-outline";
  if (!href) return null;
  if (isExternalHref(href)) {
    return (
      <a href={href} className={className} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function PhotoFrame({
  photo,
  className,
  sizes,
  priority = false,
}: {
  photo?: PhotoDTO;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("about-photo-frame", className)}>
      {photo ? (
        <ResponsiveImage photo={photo} sizes={sizes} priority={priority} className="h-full w-full" />
      ) : (
        <div className="about-photo-placeholder" aria-hidden="true" />
      )}
    </div>
  );
}

function SectionHeading({ block }: { block: AboutBlockData }) {
  const eyebrow = (block.sectionEyebrow ?? "").trim();
  const title = (block.sectionTitle ?? "").trim();
  if (!eyebrow && !title) return null;
  return (
    <div className="about-reflector-heading">
      {eyebrow && <div className="about-reflector-heading-eyebrow">{eyebrow}</div>}
      {title && <h2>{title}</h2>}
    </div>
  );
}

function BodyText({ text }: { text: string }) {
  const parts = paragraphs(text);
  if (parts.length === 0) return null;
  return (
    <div className="about-reflector-description">
      {parts.map((part, index) => (
        <p key={index}>{part}</p>
      ))}
    </div>
  );
}

function SimpleAbout({
  block,
  primary,
}: {
  block: AboutBlockData;
  primary?: PhotoDTO;
}) {
  return (
    <div className="about-section-simple">
      <div className="content-wrap">
        <div className="inner">
          <h3 className="title">{block.headline || "HI, I'M REFLECTOR"}</h3>
          <BodyText text={block.body ?? ""} />
          {block.ctaLabel && block.ctaHref && (
            <div className="btn-wrap">
              <AboutButton href={block.ctaHref} variant="line">
                {block.ctaLabel}
              </AboutButton>
            </div>
          )}
        </div>
      </div>
      <div className="images-wrap">
        <PhotoFrame
          photo={primary}
          sizes="(min-width: 1024px) 42vw, 100vw"
          className="simple-author-image"
          priority
        />
      </div>
    </div>
  );
}

function InfoBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  if (!title && !children) return null;
  return (
    <div className="block-info">
      {title && <div className="block-title">{title}</div>}
      {children}
    </div>
  );
}

function ModernAbout({
  block,
  primary,
}: {
  block: AboutBlockData;
  primary?: PhotoDTO;
}) {
  const socialLinks = [
    { label: "Facebook", short: "F", href: block.facebookUrl },
    { label: "X / Twitter", short: "X", href: block.twitterUrl },
    { label: "Instagram", short: "I", href: block.instagramUrl },
  ].filter((link) => link.href?.trim());
  const pressLinks = block.pressLinks ?? [];
  const awardLinks = block.awardLinks ?? [];
  const phoneHref = (block.phoneNumber ?? "").replace(/[^\d+]/g, "");

  return (
    <div className="about-section-modern">
      <div className="content-wrap">
        <h3 className="title">{block.headline || "ABOUT ME"}</h3>
        <BodyText text={block.body ?? ""} />

        <InfoBlock title={block.contactTitle ?? ""}>
          <div className="text">
            {block.address && <div className="address">{block.address}</div>}
            {block.phoneNumber && (
              <div className="phone">
                {block.phoneLabel || "Ph:"}
                <a href={`tel:${phoneHref}`}>{block.phoneNumber}</a>
              </div>
            )}
          </div>
          {socialLinks.length > 0 && (
            <div className="socials">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="info-socials"
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={link.label}
                >
                  {link.short}
                </a>
              ))}
            </div>
          )}
        </InfoBlock>

        {pressLinks.length > 0 && (
          <InfoBlock title={block.pressTitle ?? ""}>
            <div className="custom-links">
              {pressLinks.map((link) => (
                <div key={link.id}>
                  <a href={link.href || "#"} className="custom-link">
                    {link.label}
                  </a>
                </div>
              ))}
            </div>
          </InfoBlock>
        )}

        {awardLinks.length > 0 && (
          <InfoBlock title={block.awardsTitle ?? ""}>
            <div className="custom-links">
              {awardLinks.map((link) => (
                <div key={link.id}>
                  <a href={link.href || "#"} className="custom-link">
                    {link.label}
                  </a>
                </div>
              ))}
            </div>
          </InfoBlock>
        )}

        {block.collaboratorsText && (
          <InfoBlock title={block.collaboratorsTitle ?? ""}>
            <div className="text">{block.collaboratorsText}</div>
          </InfoBlock>
        )}

        {block.showContactForm !== false && (
          <InfoBlock title={block.contactFormTitle ?? ""}>
            <AboutContactForm submitLabel={block.submitLabel || "Send"} />
          </InfoBlock>
        )}
      </div>

      <div className="images-wrap">
        <div className="img-wrap">
          <PhotoFrame
            photo={primary}
            sizes="(min-width: 1024px) 42vw, 100vw"
            className="modern-author-image"
            priority
          />
        </div>
      </div>
    </div>
  );
}

function ToraAboutMe({
  block,
  primary,
}: {
  block: AboutBlockData;
  primary?: PhotoDTO;
}) {
  const socialLinks = [
    { label: "Facebook", icon: Facebook, href: block.facebookUrl },
    { label: "X / Twitter", icon: Twitter, href: block.twitterUrl },
    { label: "Instagram", icon: Instagram, href: block.instagramUrl },
  ].filter((link) => link.href?.trim());
  const pressLinks = block.pressLinks ?? [];
  const awardLinks = block.awardLinks ?? [];
  const phoneHref = (block.phoneNumber ?? "").replace(/[^\d+]/g, "");

  return (
    <ToraAboutMeFit>
      <div className="content-wrap">
        <h3 className="title">{block.headline || "ABOUT ME"}</h3>
        <BodyText text={block.body ?? ""} />

        <InfoBlock title={block.contactTitle ?? ""}>
          <div className="text">
            {block.address && <div className="address">{block.address}</div>}
            {block.phoneNumber && (
              <div className="phone">
                {block.phoneLabel || "Ph:"}
                <a href={`tel:${phoneHref}`}>{block.phoneNumber}</a>
              </div>
            )}
          </div>
          {socialLinks.length > 0 && (
            <div className="socials">
              {socialLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    className="info-socials"
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={link.label}
                  >
                    <Icon aria-hidden="true" />
                  </a>
                );
              })}
            </div>
          )}
        </InfoBlock>

        {pressLinks.length > 0 && (
          <InfoBlock title={block.pressTitle ?? ""}>
            <div className="custom-links">
              {pressLinks.map((link) => (
                <div key={link.id}>
                  <a href={link.href || "#"} className="custom-link">
                    {link.label}
                  </a>
                </div>
              ))}
            </div>
          </InfoBlock>
        )}

        {awardLinks.length > 0 && (
          <InfoBlock title={block.awardsTitle ?? ""}>
            <div className="custom-links">
              {awardLinks.map((link) => (
                <div key={link.id}>
                  <a href={link.href || "#"} className="custom-link">
                    {link.label}
                  </a>
                </div>
              ))}
            </div>
          </InfoBlock>
        )}

        {block.collaboratorsText && (
          <InfoBlock title={block.collaboratorsTitle ?? ""}>
            <div className="text">{block.collaboratorsText}</div>
          </InfoBlock>
        )}

        {block.showContactForm !== false && (
          <InfoBlock title={block.contactFormTitle ?? ""}>
            <AboutContactForm submitLabel={block.submitLabel || "Send"} />
          </InfoBlock>
        )}
      </div>

      <div className="images-wrap">
        <div className="img-wrap">
          <PhotoFrame
            photo={primary}
            sizes="(min-width: 1024px) 36vw, 100vw"
            className="tora-about-me-author-image"
            priority
          />
        </div>
      </div>
    </ToraAboutMeFit>
  );
}

function ClassicAbout({
  block,
  primary,
  secondary,
  tertiary,
}: {
  block: AboutBlockData;
  primary?: PhotoDTO;
  secondary?: PhotoDTO;
  tertiary?: PhotoDTO;
}) {
  return (
    <div className="about-section-classic">
      <div className="content-wrap">
        <div className="inner">
          {(block.eyebrow || "GET TO KNOW ME") && (
            <div className="subtitle">{block.eyebrow || "GET TO KNOW ME"}</div>
          )}
          <h3 className="title">{block.headline || "GET TO KNOW ME BETTER"}</h3>
          {block.quote && <div className="blockquote">{block.quote}</div>}
          <BodyText text={block.body ?? ""} />
          {block.ctaLabel && block.ctaHref && (
            <div>
              <AboutButton href={block.ctaHref} variant="outline">
                {block.ctaLabel}
              </AboutButton>
            </div>
          )}
        </div>
      </div>
      <div className="images-wrap">
        <PhotoFrame photo={primary} sizes="(min-width: 1024px) 21vw, 100vw" className="img-wrap" />
        <PhotoFrame photo={secondary} sizes="(min-width: 1024px) 21vw, 100vw" className="img-wrap" />
        <PhotoFrame photo={tertiary} sizes="(min-width: 1024px) 21vw, 100vw" className="img-wrap" />
      </div>
    </div>
  );
}

function CastingAbout({
  block,
  primary,
  secondary,
  tertiary,
}: {
  block: AboutBlockData;
  primary?: PhotoDTO;
  secondary?: PhotoDTO;
  tertiary?: PhotoDTO;
}) {
  const headline = block.headline?.trim() || "CASTING";
  const photos = [
    { photo: primary, className: "casting-photo casting-photo-primary" },
    { photo: secondary, className: "casting-photo casting-photo-secondary" },
    { photo: tertiary, className: "casting-photo casting-photo-tertiary" },
  ];

  return (
    <div className="about-section-casting">
      <h3 className="title">{headline}</h3>
      <div className="casting-photos" aria-label={`${headline} photos`}>
        {photos.map((item, index) => (
          <PhotoFrame
            key={index}
            photo={item.photo}
            sizes="(min-width: 1024px) 350px, (min-width: 768px) 30vw, 100vw"
            priority={index === 0}
            className={item.className}
          />
        ))}
      </div>
      <BodyText text={block.body ?? ""} />
    </div>
  );
}

export function AboutBlock({
  block,
  photoMap,
}: {
  block: AboutBlockData;
  photoMap: Map<string, PhotoDTO>;
}) {
  const primary = block.primaryPhotoId ? photoMap.get(block.primaryPhotoId) : undefined;
  const secondary = block.secondaryPhotoId ? photoMap.get(block.secondaryPhotoId) : undefined;
  const tertiary = block.tertiaryPhotoId ? photoMap.get(block.tertiaryPhotoId) : undefined;
  const layout = block.layout ?? "simple";
  const casting = layout === "tora-casting";
  const toraAboutMe = layout === "tora-about-me";

  return (
    <section
      className={cn(
        "about-reflector-block",
        layout === "classic" && "about-reflector-block-classic",
        casting && "about-reflector-block-casting",
        toraAboutMe && "about-reflector-block-tora-about-me",
      )}
    >
      <div className="about-reflector-container">
        {casting ? (
          <CastingAbout
            block={block}
            primary={primary}
            secondary={secondary}
            tertiary={tertiary}
          />
        ) : toraAboutMe ? (
          <ToraAboutMe block={block} primary={primary} />
        ) : (
          <>
            <SectionHeading block={block} />
            {layout === "modern" ? (
          <ModernAbout block={block} primary={primary} />
            ) : layout === "classic" ? (
              <ClassicAbout
                block={block}
                primary={primary}
                secondary={secondary}
                tertiary={tertiary}
              />
            ) : (
              <SimpleAbout block={block} primary={primary} />
            )}
          </>
        )}
      </div>
    </section>
  );
}
