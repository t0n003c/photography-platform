import Link from "next/link";
import { Quote } from "lucide-react";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import {
  ToraInfoAccordion,
  ToraInfoTabs,
  type ToraInfoTabViewItem,
} from "@/components/blocks/tora-info-block-client";
import type { PhotoDTO } from "@/src/db/queries/photos";
import type { LeafBlock } from "@/src/lib/blocks";
import { cn } from "@/src/lib/utils";

type InfoBlockData = Extract<LeafBlock, { type: "infoBlock" }>;
type PhotoMap = Map<string, PhotoDTO>;

function Paragraphs({ text }: { text: string }) {
  const parts = text.split(/\n{2,}/).filter((part) => part.trim());
  return (
    <>
      {parts.map((part, index) => (
        <p key={index}>
          {part.split("\n").map((line, lineIndex, lines) => (
            <span key={lineIndex}>
              {line}
              {lineIndex < lines.length - 1 && <br />}
            </span>
          ))}
        </p>
      ))}
    </>
  );
}

function isExternalHref(href: string) {
  return (
    /^(https?:)?\/\//.test(href) ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  );
}

function ToraInfoButton({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  const cleanHref = href.trim() || "#";
  const cleanLabel = label.trim();
  if (!cleanLabel) return null;
  if (isExternalHref(cleanHref)) {
    return (
      <a
        href={cleanHref}
        className={cn("tora-info-button", className)}
        target="_blank"
        rel="noreferrer noopener"
      >
        {cleanLabel}
      </a>
    );
  }
  return (
    <Link href={cleanHref} className={cn("tora-info-button", className)}>
      {cleanLabel}
    </Link>
  );
}

function ToraInfoPhoto({
  photo,
  className,
  sizes,
  priority,
  objectFit = "cover",
}: {
  photo?: PhotoDTO;
  className: string;
  sizes: string;
  priority?: boolean;
  objectFit?: "cover" | "contain";
}) {
  if (!photo) {
    return (
      <div
        className={cn(className, "tora-info-image-placeholder")}
        aria-hidden="true"
      />
    );
  }
  return (
    <ResponsiveImage
      photo={photo}
      sizes={sizes}
      priority={priority}
      className={className}
      imgClassName={cn(
        "block h-full w-full",
        objectFit === "contain" ? "object-contain" : "object-cover",
      )}
      showPlaceholderBackdrop={objectFit !== "contain"}
    />
  );
}

function photoById(photoMap: PhotoMap, id: string | null | undefined) {
  return id ? photoMap.get(id) : undefined;
}

export function ToraInfoBlock({
  block,
  photoMap,
}: {
  block: InfoBlockData;
  photoMap: PhotoMap;
}) {
  const title = block.title.trim();
  const eyebrow = block.eyebrow.trim();
  const text = block.text.trim();
  const quote = block.quote.trim();
  const primaryPhoto = photoById(photoMap, block.photoId);
  const secondaryPhoto = photoById(photoMap, block.secondaryPhotoId);

  if (block.style === "creative") {
    return (
      <section className="tora-info-block tora-info-block--creative">
        <div className="tora-info-creative">
          <ToraInfoPhoto
            photo={primaryPhoto}
            className="tora-info-creative__image"
            sizes="(max-width: 991px) 100vw, 60vw"
            priority
          />
          <div className="tora-info-creative__panel">
            {eyebrow && <p className="tora-info-creative__eyebrow">{eyebrow}</p>}
            {title && <h2 className="tora-info-creative__title">{title}</h2>}
            {text && (
              <div className="tora-info-creative__text">
                <Paragraphs text={text} />
              </div>
            )}
            <ToraInfoButton
              href={block.buttonHref}
              label={block.buttonLabel}
              className="tora-info-button--light"
            />
          </div>
        </div>
      </section>
    );
  }

  if (block.style === "simpleText") {
    return (
      <section className="tora-info-block tora-info-block--simple-text">
        <div className="tora-info-simple-text">
          <Paragraphs text={text} />
        </div>
      </section>
    );
  }

  if (block.style === "quote") {
    return (
      <section className="tora-info-block tora-info-block--quote">
        <div className="tora-info-quote">
          <Quote className="tora-info-quote__icon" aria-hidden="true" />
          <blockquote className="tora-info-quote__text">{quote || text}</blockquote>
        </div>
      </section>
    );
  }

  if (block.style === "infoList") {
    return (
      <section
        className={cn(
          "tora-info-block tora-info-block--info-list",
          !primaryPhoto && "tora-info-block--no-photo",
        )}
      >
        <ToraInfoPhoto
          photo={primaryPhoto}
          className="tora-info-list__image"
          sizes="100vw"
        />
        <div className="tora-info-list__shade" aria-hidden="true" />
        <div className="tora-info-list__content">
          {title && <h2 className="tora-info-list__title">{title}</h2>}
          {text && (
            <div className="tora-info-list__text">
              <Paragraphs text={text} />
            </div>
          )}
        </div>
      </section>
    );
  }

  if (block.style === "classic") {
    return (
      <section className="tora-info-block tora-info-block--classic">
        <div className="tora-info-classic">
          {title && <h2 className="tora-info-classic__title">{title}</h2>}
          {text && (
            <div className="tora-info-classic__text">
              <Paragraphs text={text} />
            </div>
          )}
          <ToraInfoButton href={block.buttonHref} label={block.buttonLabel} />
        </div>
      </section>
    );
  }

  if (block.style === "tabs") {
    const items: ToraInfoTabViewItem[] = block.tabs.map((item) => ({
      id: item.id,
      title: item.title,
      text: item.text,
      photo: photoById(photoMap, item.photoId) ?? null,
      accentPhoto: photoById(photoMap, item.accentPhotoId) ?? null,
    }));
    return (
      <section className="tora-info-block tora-info-block--tabs">
        <ToraInfoTabs eyebrow={eyebrow} text={text} items={items} />
      </section>
    );
  }

  if (block.style === "textStyle") {
    return (
      <section className="tora-info-block tora-info-block--text-style">
        <div className="tora-info-text-style">
          <div className="tora-info-text-style__heading">
            {eyebrow && <p>{eyebrow}</p>}
            {title && <h2>{title}</h2>}
          </div>
          {text && (
            <div className="tora-info-text-style__text">
              <Paragraphs text={text} />
            </div>
          )}
        </div>
      </section>
    );
  }

  if (block.style === "accordion") {
    return (
      <section className="tora-info-block tora-info-block--accordion">
        <ToraInfoAccordion items={block.accordionItems} />
      </section>
    );
  }

  if (block.style === "simple") {
    return (
      <section className="tora-info-block tora-info-block--simple">
        <div className="tora-info-simple">
          {eyebrow && <p className="tora-info-simple__eyebrow">{eyebrow}</p>}
          {text && (
            <div className="tora-info-simple__text">
              <Paragraphs text={text} />
            </div>
          )}
          <ToraInfoButton href={block.buttonHref} label={block.buttonLabel} />
        </div>
      </section>
    );
  }

  return (
    <section className="tora-info-block tora-info-block--modern">
      <div className="tora-info-modern">
        {eyebrow && <p className="tora-info-modern__eyebrow">{eyebrow}</p>}
        {title && <h2 className="tora-info-modern__title">{title}</h2>}
        {quote && <blockquote className="tora-info-modern__quote">{quote}</blockquote>}
        {text && (
          <div className="tora-info-modern__text">
            <Paragraphs text={text} />
          </div>
        )}
        {secondaryPhoto && (
          <ToraInfoPhoto
            photo={secondaryPhoto}
            className="tora-info-modern__signature"
            sizes="187px"
            objectFit="contain"
          />
        )}
      </div>
    </section>
  );
}
