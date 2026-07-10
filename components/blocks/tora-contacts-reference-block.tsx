import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { ContactForm } from "@/components/forms/contact-form";
import type { PhotoDTO } from "@/src/db/queries/photos";
import type { LeafBlock } from "@/src/lib/blocks";
import { cn } from "@/src/lib/utils";

type ContactBlockData = Extract<LeafBlock, { type: "contactForm" }>;
type CSSVars = CSSProperties & { [key: `--${string}`]: string | number | undefined };

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function ReferenceLink({
  href,
  className,
  children,
}: {
  href?: string | null;
  className?: string;
  children: ReactNode;
}) {
  const cleanHref = (href ?? "").trim();
  if (!cleanHref || cleanHref === "#") {
    return <span className={className}>{children}</span>;
  }
  if (isExternalHref(cleanHref)) {
    return (
      <a href={cleanHref} className={className} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    );
  }
  return (
    <Link href={cleanHref} className={className}>
      {children}
    </Link>
  );
}

function SectionHeading({
  eyebrow,
  title,
}: {
  eyebrow?: string | null;
  title?: string | null;
}) {
  const cleanEyebrow = (eyebrow ?? "").trim();
  const cleanTitle = (title ?? "").trim();
  if (!cleanEyebrow && !cleanTitle) return null;
  return (
    <div className="tora-contact-reference-heading">
      {cleanEyebrow && <p>{cleanEyebrow}</p>}
      {cleanTitle && <h2>{cleanTitle}</h2>}
    </div>
  );
}

function MosaicFrame({
  photo,
  index,
}: {
  photo?: PhotoDTO;
  index: number;
}) {
  return (
    <div className="tora-contact-reference-mosaic__item">
      {photo ? (
        <ResponsiveImage
          photo={photo}
          sizes="(min-width: 1200px) 170px, (min-width: 768px) 15vw, 50vw"
          className="h-full w-full"
        />
      ) : (
        <div className={cn("tora-contact-reference-mosaic__placeholder", `is-${(index % 6) + 1}`)} aria-hidden="true" />
      )}
    </div>
  );
}

export function ToraContactsReferenceBlock({
  block,
  photoMap,
}: {
  block: ContactBlockData;
  photoMap: Map<string, PhotoDTO>;
}) {
  const heroPhoto = block.contactHeroPhotoId ? photoMap.get(block.contactHeroPhotoId) : undefined;
  const mosaicPhotos = (block.contactImagePhotoIds ?? [])
    .map((id) => photoMap.get(id))
    .filter((photo): photo is PhotoDTO => Boolean(photo));
  const mosaicFrames = mosaicPhotos.length > 0
    ? mosaicPhotos
    : Array.from<PhotoDTO | undefined>({ length: 6 }).fill(undefined);
  const heroTitle = (block.contactHeroTitle ?? "").trim() || "CONTACTS";
  const infoIntro =
    (block.contactInfoIntro ?? "").trim() ||
    "IF YOU NEED TO MESSAGE US, PLEASE FILL OUT THE FORM BELLOW";
  const infoItems = (block.contactInfoItems ?? []).length > 0
    ? block.contactInfoItems
    : [
        {
          id: "photostudio",
          title: "PHOTOSTUDIO",
          address: "231 Main Street Chicago, IL",
          phone: "+1 312 229 9000",
          href: "",
        },
        {
          id: "office",
          title: "OFFICE",
          address: "93 W Division Street Chicago, IL",
          phone: "+1 312 943 0367",
          href: "",
        },
      ];
  const socialLinks = block.contactSocialLinks ?? [];
  const overlay = Math.min(Math.max(block.contactHeroOverlayOpacity ?? 0.45, 0), 0.85);
  const vars: CSSVars = {
    "--tora-contact-ref-hero-overlay": overlay,
  };
  const formHeading =
    (block.contactImageHeading ?? "").trim() ||
    (block.contactInfoHeading ?? "").trim() ||
    block.heading ||
    "Contact";

  return (
    <section className="tora-contact-reference" style={vars}>
      <div className="tora-contact-reference-hero">
        {heroPhoto ? (
          <ResponsiveImage
            photo={heroPhoto}
            sizes="100vw"
            priority
            className="tora-contact-reference-hero__image"
          />
        ) : (
          <div className="tora-contact-reference-hero__placeholder" aria-hidden="true" />
        )}
        <span className="tora-contact-reference-hero__overlay" aria-hidden="true" />
        <h1>{heroTitle}</h1>
      </div>

      <div className="tora-contact-reference__section tora-contact-reference__section--info-heading">
        <SectionHeading eyebrow={block.contactInfoEyebrow} title={block.contactInfoHeading} />
      </div>

      <div className="tora-contact-reference-info">
        <div className="tora-contact-reference-info__intro">
          <p>{infoIntro}</p>
        </div>
        {infoItems.map((item) => (
          <div className="tora-contact-reference-info__item" key={item.id}>
            <h3>{item.title}</h3>
            {item.address && <p>{item.address}</p>}
            {item.phone && (
              <ReferenceLink href={item.href} className="tora-contact-reference-info__phone">
                {item.phone}
              </ReferenceLink>
            )}
          </div>
        ))}
      </div>

      <div className="tora-contact-reference__section tora-contact-reference__section--image-heading">
        <SectionHeading eyebrow={block.contactImageEyebrow} title={block.contactImageHeading} />
      </div>

      <div className="tora-contact-reference-image-form">
        {socialLinks.length > 0 && (
          <div className="tora-contact-reference-socials">
            {socialLinks.map((link) => (
              <ReferenceLink href={link.href} className="tora-contact-reference-socials__link" key={link.id}>
                {link.label}
              </ReferenceLink>
            ))}
          </div>
        )}
        <div className="tora-contact-reference-image-form__content">
          <div className="tora-contact-reference-mosaic">
            {mosaicFrames.map((photo, index) => (
              <MosaicFrame
                key={photo?.id ?? `placeholder-${index}`}
                photo={photo}
                index={index}
              />
            ))}
          </div>
          <div className="tora-contact-reference-form-wrap">
            <ContactForm
              submitLabel={block.submitLabel || "SUBMIT NOW"}
              variant="tora"
              subjectFallback={formHeading}
              toraLayout="stacked"
              showPhone
              toraPlaceholders={{
                name: "Name",
                email: "Email",
                phone: "Phone Number",
                message: "Message",
              }}
            />
          </div>
          {block.contactSideCaption && (
            <div className="tora-contact-reference-copy" aria-label={block.contactSideCaption}>
              <span>{block.contactSideCaption}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
