"use client";

import {
  useMemo,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import {
  ArrowRight,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  UsersRound,
  Youtube,
} from "lucide-react";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { cn } from "@/src/lib/utils";
import type { PhotoDTO } from "@/src/db/queries/photos";
import type { LeafBlock } from "@/src/lib/blocks";

type TeamBlockData = Extract<LeafBlock, { type: "team" }>;
type TeamMember = TeamBlockData["members"][number];

interface TeamShowcaseBlockProps {
  block: TeamBlockData;
  photoMap: Map<string, PhotoDTO>;
}

const COLUMN_CLASSES = [
  {
    column: "gap-2 md:gap-3",
    card: "w-[110px] h-[120px] sm:w-[130px] sm:h-[140px] md:w-[155px] md:h-[165px]",
  },
  {
    column: "mt-[48px] gap-2 md:mt-[68px] md:gap-3 sm:mt-[56px]",
    card: "w-[122px] h-[132px] sm:w-[145px] sm:h-[155px] md:w-[172px] md:h-[182px]",
  },
  {
    column: "mt-[22px] gap-2 md:mt-[32px] md:gap-3 sm:mt-[26px]",
    card: "w-[115px] h-[125px] sm:w-[136px] sm:h-[146px] md:w-[162px] md:h-[172px]",
  },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "T") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function memberIsEmpty(member: TeamMember) {
  return !(
    member.name.trim() ||
    member.role.trim() ||
    member.description?.trim() ||
    member.photoId ||
    member.twitterUrl.trim() ||
    member.linkedinUrl.trim() ||
    member.instagramUrl.trim() ||
    member.behanceUrl.trim()
  );
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: parts[0] || "Team", lastName: "Member" };
  }
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function editorialPosition(
  block: TeamBlockData,
  index: number,
): "left" | "right" {
  if (block.cardPosition === "left" || block.cardPosition === "right") {
    return block.cardPosition;
  }
  return index % 2 === 0 ? "left" : "right";
}

function marqueeDuration(speed?: number) {
  const next = Number(speed);
  if (!Number.isFinite(next)) return 32;
  return Math.max(12, Math.min(80, next));
}

function PlaceholderPortrait({
  member,
  className,
}: {
  member: TeamMember;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center bg-[linear-gradient(145deg,hsl(var(--muted)),hsl(var(--foreground)))] text-2xl font-semibold text-[hsl(var(--background))]",
        className,
      )}
    >
      {initials(member.name)}
    </div>
  );
}

function socialLinks(member: TeamMember) {
  return [
    { label: "X", url: member.twitterUrl },
    { label: "in", url: member.linkedinUrl },
    { label: "ig", url: member.instagramUrl },
    { label: "be", url: member.behanceUrl },
  ].filter((link) => link.url.trim());
}

function linkAttrs(href: string) {
  const clean = href.trim() || "#";
  if (/^(https?:)?\/\//i.test(clean)) {
    return { href: clean, target: "_blank", rel: "noreferrer" };
  }
  return { href: clean };
}

function creativeMainLinks(block: TeamBlockData) {
  return [
    { label: "X / Twitter", icon: Twitter, url: block.creativeTwitterUrl },
    { label: "Facebook", icon: Facebook, url: block.creativeFacebookUrl },
    { label: "Instagram", icon: Instagram, url: block.creativeInstagramUrl },
    { label: "YouTube", icon: Youtube, url: block.creativeYoutubeUrl },
  ].filter((link) => Boolean(link.url?.trim()));
}

function creativeMemberLinks(member: TeamMember) {
  return [
    { label: "X / Twitter", icon: Twitter, url: member.twitterUrl },
    { label: "LinkedIn", icon: Linkedin, url: member.linkedinUrl },
    { label: "Instagram", icon: Instagram, url: member.instagramUrl },
    { label: "Behance", text: "Be", url: member.behanceUrl },
  ].filter((link) => link.url.trim());
}

function SocialLinks({ member, active }: { member: TeamMember; active: boolean }) {
  const links = socialLinks(member);
  if (links.length === 0) return null;
  return (
    <span
      className={cn(
        "ml-3 inline-flex items-center gap-2 text-[10px] font-semibold leading-none tracking-normal transition duration-200 motion-reduce:transition-none",
        active
          ? "translate-x-0 opacity-100"
          : "pointer-events-none -translate-x-2 opacity-0",
      )}
      aria-hidden={!active}
    >
      {links.map((link) => (
        <a
          key={link.label}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          tabIndex={active ? 0 : -1}
          aria-label={`${member.name} ${link.label}`}
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-[hsl(var(--foreground))]/20 px-1.5 text-[hsl(var(--foreground))] transition hover:border-[hsl(var(--foreground))] hover:bg-[hsl(var(--foreground))] hover:text-[hsl(var(--background))]"
        >
          {link.label}
        </a>
      ))}
    </span>
  );
}

function PortraitCard({
  member,
  photo,
  active,
  dimmed,
  grayscale,
  priority,
  className,
  onActivate,
}: {
  member: TeamMember;
  photo?: PhotoDTO;
  active: boolean;
  dimmed: boolean;
  grayscale: boolean;
  priority: boolean;
  className: string;
  onActivate: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "team-showcase-card relative shrink-0 overflow-hidden rounded-xl bg-[hsl(var(--muted))] text-left outline-none transition-[opacity,filter,transform] duration-500 focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] motion-reduce:transition-none",
        active ? "scale-[1.015]" : "scale-100",
        dimmed ? "opacity-60" : "opacity-100",
        className,
      )}
      onMouseEnter={onActivate}
      onPointerDown={onActivate}
      onFocus={onActivate}
      onClick={onActivate}
      aria-label={`Show ${member.name}`}
    >
      {photo ? (
        <ResponsiveImage
          photo={photo}
          sizes="(max-width: 767px) 40vw, 172px"
          priority={priority}
          className="h-full w-full"
          style={{
            filter:
              active || !grayscale
                ? "grayscale(0) brightness(1)"
                : "grayscale(1) brightness(0.77)",
            transition: "filter 500ms ease, transform 500ms ease",
          }}
        />
      ) : (
        <PlaceholderPortrait
          member={member}
          className={cn(
            "transition-[filter] duration-500 motion-reduce:transition-none",
            active || !grayscale
              ? "grayscale-0 brightness-100"
              : "grayscale brightness-[0.77]",
          )}
        />
      )}
    </button>
  );
}

function EditorialPortrait({
  member,
  photo,
  priority,
}: {
  member: TeamMember;
  photo?: PhotoDTO;
  priority: boolean;
}) {
  const fullName = member.name || "Team member";
  return (
    <div className="team-editorial-portrait group relative h-[26rem] w-full max-w-[22.5rem] shrink-0 overflow-hidden bg-[hsl(var(--muted))] sm:h-[30rem] md:h-[31.25rem] md:w-[22.5rem]">
      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
      {photo ? (
        <ResponsiveImage
          photo={photo}
          sizes="(max-width: 767px) 90vw, 360px"
          priority={priority}
          className="h-full w-full transition-transform duration-500 ease-[0.22,1,0.36,1] group-hover:scale-105 motion-reduce:transition-none"
        />
      ) : (
        <PlaceholderPortrait
          member={member}
          className="transition-transform duration-500 ease-[0.22,1,0.36,1] group-hover:scale-105 motion-reduce:transition-none"
        />
      )}
      <span className="sr-only">{fullName}</span>
    </div>
  );
}

function EditorialTeamCard({
  block,
  member,
  photo,
  index,
  cardIndex,
  totalMembers,
  onNext,
}: {
  block: TeamBlockData;
  member: TeamMember;
  photo?: PhotoDTO;
  index: number;
  cardIndex?: number;
  totalMembers?: number;
  onNext?: () => void;
}) {
  const position = editorialPosition(block, index);
  const isRight = position === "right";
  const { firstName, lastName } = splitName(member.name);
  const description =
    member.description?.trim() ||
    "Share a short bio, specialty, or role description for this team member.";
  const memberCount = totalMembers ?? 0;
  const canAdvance = Boolean(onNext && memberCount > 1);
  const nextLabel = canAdvance
    ? `Show next team member, ${cardIndex === memberCount - 1 ? "back to the first member" : "next member"}`
    : `View ${member.name || "team member"}`;

  return (
    <article
      className="team-editorial-card relative my-10 flex flex-col justify-center md:my-12"
      style={{ "--team-delay": "0ms" } as CSSProperties}
    >
      <div className="team-editorial-role">
        <p
          className={cn(
            "mb-4 text-xs font-medium uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500",
            isRight && "md:text-right",
          )}
        >
          {member.role || "Team member"}
        </p>
      </div>

      <div
        className={cn(
          "flex flex-col items-start gap-8 md:flex-row md:items-center md:gap-0",
          isRight ? "md:justify-start" : "md:justify-end",
        )}
      >
        <div className={cn(isRight && "md:order-2")}>
          <EditorialPortrait
            member={member}
            photo={photo}
            priority={index === 0}
          />
        </div>

        <div
          className={cn(
            "team-editorial-info relative z-[2] flex w-full flex-col gap-7 md:w-[calc(100%-350px)] md:gap-14",
            isRight ? "md:left-8 md:items-end" : "md:-left-8",
          )}
        >
          <div>
            <p className="text-4xl font-extralight leading-[1.1] tracking-tight text-zinc-900 dark:text-white sm:text-5xl">
              {firstName}
              <br />
              <span className="font-normal">{lastName}</span>
            </p>
          </div>

          <div
            className={cn(
              "flex flex-col gap-6 sm:flex-row sm:gap-8",
              isRight && "md:justify-end",
            )}
          >
            {block.showCardArrow !== false && (
              <button
                type="button"
                aria-label={nextLabel}
                onClick={canAdvance ? onNext : undefined}
                disabled={!canAdvance}
                className={cn(
                  "team-editorial-arrow group flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center rounded-full border border-zinc-300 transition-[transform,background-color,border-color] duration-300 hover:scale-110 hover:border-zinc-600 hover:bg-zinc-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] dark:border-white/20 dark:hover:border-white/60 dark:hover:bg-white/10 motion-reduce:transition-none",
                  !canAdvance && "cursor-default opacity-70 hover:scale-100 hover:border-zinc-300 hover:bg-transparent dark:hover:border-white/20 dark:hover:bg-transparent",
                  isRight && "sm:order-2",
                )}
              >
                <ArrowRight
                  size={22}
                  className={cn(
                    "text-zinc-600 transition-all duration-300 group-hover:-rotate-45 group-hover:text-white dark:text-zinc-400 dark:group-hover:text-white motion-reduce:transition-none",
                    isRight && "rotate-180 group-hover:rotate-[225deg]",
                  )}
                />
              </button>
            )}

            <div className="w-full sm:max-w-[22rem] md:w-[40%]">
              <p
                className={cn(
                  "text-sm leading-[1.8] text-zinc-500 dark:text-zinc-400",
                  isRight && "md:text-right",
                )}
              >
                {description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function EditorialTeamCards({
  block,
  members,
  photoMap,
}: {
  block: TeamBlockData;
  members: TeamMember[];
  photoMap: Map<string, PhotoDTO>;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const safeActiveIndex = activeIndex < members.length ? activeIndex : 0;
  const activeMember = members[safeActiveIndex] ?? members[0];
  const activePhoto = activeMember?.photoId
    ? photoMap.get(activeMember.photoId)
    : undefined;

  if (!activeMember) return null;

  return (
    <section className="team-showcase-block team-editorial-block overflow-x-clip bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
        {block.title.trim() && (
          <h2 className="mb-8 text-xs font-medium uppercase tracking-[0.24em] text-[hsl(var(--muted-foreground))]">
            {block.title}
          </h2>
        )}
        <EditorialTeamCard
          key={activeMember.id}
          block={block}
          member={activeMember}
          photo={activePhoto}
          index={safeActiveIndex}
          cardIndex={safeActiveIndex}
          totalMembers={members.length}
          onNext={() => setActiveIndex((current) => (current + 1) % members.length)}
        />
      </div>
    </section>
  );
}

function MarqueeTeamCard({
  member,
  photo,
  priority,
  grayscale,
}: {
  member: TeamMember;
  photo?: PhotoDTO;
  priority: boolean;
  grayscale: boolean;
}) {
  return (
    <div className="group flex w-56 shrink-0 flex-col sm:w-64">
      <div className="relative h-80 w-full overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800 sm:h-[23rem]">
        {photo ? (
          <ResponsiveImage
            photo={photo}
            sizes="(max-width: 767px) 224px, 256px"
            priority={priority}
            className={cn(
              "h-full w-full transition-[filter] duration-300 motion-reduce:transition-none",
              grayscale && "grayscale group-hover:grayscale-0",
            )}
          />
        ) : (
          <PlaceholderPortrait
            member={member}
            className={cn(
              "transition-[filter] duration-300 motion-reduce:transition-none",
              grayscale && "grayscale group-hover:grayscale-0",
            )}
          />
        )}
        <div className="absolute bottom-0 w-full rounded-lg bg-neutral-100/85 p-2 backdrop-blur-md dark:bg-neutral-800/80">
          <h3 className="truncate font-semibold text-neutral-900 dark:text-neutral-100">
            {member.name || "Team member"}
          </h3>
          <p className="truncate text-sm text-neutral-600 dark:text-neutral-400">
            {member.role || "Role"}
          </p>
        </div>
      </div>
    </div>
  );
}

function MarqueeTeamCards({
  block,
  members,
  photoMap,
}: {
  block: TeamBlockData;
  members: TeamMember[];
  photoMap: Map<string, PhotoDTO>;
}) {
  const headline = block.title.trim() || "Creative Team Members";
  const subtitle =
    block.marqueeSubtitle?.trim() ||
    "Meet the people behind the images, edits, and client experience.";
  const quote =
    block.marqueeQuote?.trim() ||
    "The care, communication, and delivery from this team made the entire experience feel effortless.";
  const quoteAuthor = block.marqueeQuoteAuthor?.trim() || "Natalia Kara";
  const quoteRole = block.marqueeQuoteRole?.trim() || "Studio client";
  const quotePhoto =
    (block.marqueeQuotePhotoId
      ? photoMap.get(block.marqueeQuotePhotoId)
      : undefined) ??
    members
      .map((member) => (member.photoId ? photoMap.get(member.photoId) : undefined))
      .find(Boolean);
  const marqueeMembers = members.length > 1 ? [...members, ...members] : members;
  const duration = `${marqueeDuration(block.marqueeSpeed)}s`;

  return (
    <section className="team-showcase-block team-marquee-block relative w-full overflow-hidden bg-white py-12 text-neutral-950 dark:bg-[hsl(var(--background))] dark:text-neutral-100 md:py-24">
      {block.marqueeShowDecorations !== false && (
        <svg
          className="pointer-events-none absolute bottom-0 right-0 text-neutral-200 dark:text-neutral-800"
          fill="none"
          height="154"
          viewBox="0 0 460 154"
          width="460"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <g clipPath="url(#team-marquee-curve)">
            <path
              d="M-87.463 458.432C-102.118 348.092 -77.3418 238.841 -15.0744 188.274C57.4129 129.408 180.708 150.071 351.748 341.128C278.246 -374.233 633.954 380.602 548.123 42.7707"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="40"
            />
          </g>
          <defs>
            <clipPath id="team-marquee-curve">
              <rect fill="white" height="154" width="460" />
            </clipPath>
          </defs>
        </svg>
      )}

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="mx-auto mb-16 flex max-w-5xl flex-col items-center px-6 text-center lg:px-0">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
            <UsersRound className="h-6 w-6" aria-hidden="true" />
          </div>

          <h2 className="relative mb-4 text-4xl font-medium tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-5xl">
            {headline}
            {block.marqueeShowDecorations !== false && (
              <svg
                className="pointer-events-none absolute -right-8 -top-2 -z-10 w-24 text-neutral-200 dark:text-neutral-700"
                fill="currentColor"
                height="86"
                viewBox="0 0 108 86"
                width="108"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M38.8484 16.236L15 43.5793L78.2688 15L18.1218 71L93 34.1172L70.2047 65.2739"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="28"
                />
              </svg>
            )}
          </h2>
          <p className="max-w-2xl text-neutral-600 dark:text-neutral-400">
            {subtitle}
          </p>
        </div>

        <div className="relative w-full">
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-20 bg-gradient-to-r from-white to-transparent dark:from-[hsl(var(--background))] sm:w-32" />
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-20 bg-gradient-to-l from-white to-transparent dark:from-[hsl(var(--background))] sm:w-32" />

          <div className="team-marquee-viewport overflow-x-auto overflow-y-hidden overscroll-x-contain">
            <div
              className={cn(
                "team-marquee-track flex w-max gap-6",
                block.marqueePauseOnHover !== false && "team-marquee-track--pause",
              )}
              style={{ "--team-marquee-duration": duration } as CSSProperties}
            >
              {marqueeMembers.map((member, index) => {
                const originalIndex = index % members.length;
                const photo = member.photoId ? photoMap.get(member.photoId) : undefined;
                return (
                  <div
                    key={`${member.id}-${index}`}
                    aria-hidden={index >= members.length ? "true" : undefined}
                  >
                    <MarqueeTeamCard
                      member={member}
                      photo={photo}
                      priority={originalIndex < 3}
                      grayscale={block.grayscale !== false}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {block.marqueeShowQuote !== false && (
          <div className="mx-auto mt-20 max-w-3xl px-6 text-center lg:px-0">
            <p className="mb-8 text-lg font-medium leading-relaxed text-neutral-900 dark:text-neutral-100 md:text-xl">
              {quote}
            </p>
            <div className="flex flex-col items-center gap-3">
              <div className="relative h-14 w-14 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                {quotePhoto ? (
                  <ResponsiveImage
                    photo={quotePhoto}
                    sizes="56px"
                    className="h-full w-full"
                  />
                ) : (
                  <PlaceholderPortrait
                    member={members[0]}
                    className="text-sm"
                  />
                )}
              </div>
              <div className="text-center">
                <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {quoteAuthor}
                </p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {quoteRole}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function CreativeTeamCard({
  member,
  photo,
  priority,
  showSocials,
  showOutline,
}: {
  member: TeamMember;
  photo?: PhotoDTO;
  priority: boolean;
  showSocials: boolean;
  showOutline: boolean;
}) {
  const links = creativeMemberLinks(member);

  return (
    <article
      className={cn(
        "group relative flex min-h-[19.5rem] flex-col items-center justify-end overflow-hidden rounded-xl bg-[hsl(var(--card))] p-6 text-center shadow-lg transition-[box-shadow,transform] duration-300 ease-in-out hover:scale-[1.02] hover:shadow-2xl focus-within:scale-[1.02] focus-within:shadow-2xl motion-reduce:transition-none",
        showOutline && "border border-[hsl(var(--border))]/70",
      )}
    >
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-1/2 origin-bottom scale-y-0 rounded-t-full transition-transform duration-500 ease-out group-hover:scale-y-100 group-focus-within:scale-y-100 motion-reduce:transition-none"
        style={{
          background:
            "linear-gradient(to top, hsl(var(--primary) / 0.2), transparent)",
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 h-36 w-36 overflow-hidden rounded-full border-4 border-transparent bg-[hsl(var(--background))]/20 transition-[border-color,transform] duration-500 ease-out group-hover:scale-105 group-hover:border-[hsl(var(--primary))] group-focus-within:scale-105 group-focus-within:border-[hsl(var(--primary))] motion-reduce:transition-none">
        {photo ? (
          <ResponsiveImage
            photo={photo}
            sizes="(max-width: 767px) 144px, 144px"
            priority={priority}
            className="h-full w-full transition-transform duration-500 ease-out group-hover:scale-110 group-focus-within:scale-110 motion-reduce:transition-none"
          />
        ) : (
          <PlaceholderPortrait
            member={member}
            className="transition-transform duration-500 ease-out group-hover:scale-110 group-focus-within:scale-110 motion-reduce:transition-none"
          />
        )}
      </div>
      <h3 className="relative z-10 mt-4 text-xl font-semibold uppercase tracking-normal text-[hsl(var(--foreground))]">
        {member.name || "Team member"}
      </h3>
      <p className="relative z-10 text-sm text-[hsl(var(--muted-foreground))]">
        {member.role || "Role"}
      </p>
      {showSocials && links.length > 0 && (
        <div className="relative z-10 mt-4 flex gap-3 opacity-100 transition-opacity duration-300 ease-in-out md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 motion-reduce:transition-none">
          {links.map((link) => {
            const Icon = "icon" in link ? link.icon : null;
            return (
              <a
                key={link.label}
                {...linkAttrs(link.url)}
                aria-label={`${member.name || "Team member"} ${link.label}`}
                className="inline-flex h-8 min-w-8 items-center justify-center rounded-full text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              >
                {Icon ? (
                  <Icon className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <span className="px-1 text-[11px] font-semibold" aria-hidden="true">
                    {link.text}
                  </span>
                )}
              </a>
            );
          })}
        </div>
      )}
    </article>
  );
}

function CreativeTeamSection({
  block,
  members,
  photoMap,
}: {
  block: TeamBlockData;
  members: TeamMember[];
  photoMap: Map<string, PhotoDTO>;
}) {
  const eyebrow = block.creativeEyebrow?.trim() || "O U R";
  const headline = block.title.trim() || "CREATIVE TEAM";
  const description =
    block.creativeDescription?.trim() ||
    "Meet the people behind the images, edits, and client experience.";
  const logo = block.creativeLogo?.trim();
  const ctaLabel = block.creativeCtaLabel?.trim();
  const ctaHref = block.creativeCtaHref?.trim();
  const websiteLabel = block.creativeWebsiteLabel?.trim();
  const websiteHref = block.creativeWebsiteHref?.trim();
  const mainLinks = creativeMainLinks(block);
  const showWebsite = Boolean(websiteLabel && websiteHref);
  const showMainRow =
    block.creativeShowMainSocials !== false &&
    (mainLinks.length > 0 || showWebsite);
  const creativeColumns = block.creativeColumns === "4" ? "4" : "3";

  return (
    <section className="team-showcase-block team-creative-section relative w-full overflow-hidden bg-[hsl(var(--background))] py-12 text-[hsl(var(--foreground))] md:py-24 lg:py-32">
      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center justify-center gap-8 px-4 text-center md:px-6">
        <div className="flex w-full flex-col items-center justify-between gap-4 md:flex-row md:items-start md:text-left lg:gap-8">
          <div className="grid gap-2 text-center md:text-left">
            <h2 className="text-4xl font-bold uppercase leading-none tracking-normal text-[hsl(var(--muted-foreground))] sm:text-5xl md:text-6xl">
              <span className="block text-xl font-medium leading-tight text-[hsl(var(--primary))] sm:text-2xl md:text-3xl">
                {eyebrow}
              </span>
              {headline}
            </h2>
            <p className="max-w-[700px] text-base leading-relaxed text-[hsl(var(--muted-foreground))] md:text-xl lg:text-base xl:text-xl">
              {description}
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 md:items-end">
            {logo && (
              <p className="text-2xl font-bold uppercase tracking-normal text-[hsl(var(--foreground))]">
                {logo}
              </p>
            )}
            {ctaLabel && ctaHref && (
              <a
                {...linkAttrs(ctaHref)}
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-[hsl(var(--primary))] px-8 py-2 text-center text-sm font-medium uppercase leading-tight text-[hsl(var(--primary-foreground))] shadow transition-colors hover:bg-[hsl(var(--primary))]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              >
                {ctaLabel}
              </a>
            )}
          </div>
        </div>

        {showMainRow && (
          <div className="flex w-full flex-wrap items-center justify-center gap-4 py-4">
            {mainLinks.map((link) => {
              const Icon = link.icon;
              return (
                <a
                  key={link.label}
                  {...linkAttrs(link.url ?? "#")}
                  aria-label={link.label}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                >
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </a>
              );
            })}
            {websiteLabel && websiteHref && (
              <a
                {...linkAttrs(websiteHref)}
                className="text-sm text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              >
                {websiteLabel}
              </a>
            )}
          </div>
        )}

        <div
          className={cn(
            "mx-auto grid w-full grid-cols-1 gap-8",
            creativeColumns === "4"
              ? "max-w-6xl md:grid-cols-4 lg:gap-8"
              : "max-w-5xl md:grid-cols-3 lg:gap-12",
          )}
        >
          {members.map((member, index) => {
            const photo = member.photoId ? photoMap.get(member.photoId) : undefined;
            return (
              <CreativeTeamCard
                key={member.id}
                member={member}
                photo={photo}
                priority={index < 3}
                showSocials={block.showSocials !== false}
                showOutline={block.creativeShowCardOutline !== false}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function TeamShowcaseBlock({ block, photoMap }: TeamShowcaseBlockProps) {
  const members = useMemo(
    () => (block.members ?? []).filter((member) => !memberIsEmpty(member)),
    [block.members],
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeMember = activeId
    ? members.find((member) => member.id === activeId)
    : null;
  const activeMemberId = activeMember?.id ?? null;
  const columns = [
    members.filter((_, index) => index % 3 === 0),
    members.filter((_, index) => index % 3 === 1),
    members.filter((_, index) => index % 3 === 2),
  ].filter((column) => column.length > 0);

  if (members.length === 0) {
    return (
      <section className="team-showcase-block bg-[hsl(var(--background))] py-8 text-[hsl(var(--foreground))]">
        <div className="mx-auto flex min-h-64 max-w-5xl items-center justify-center rounded-lg border border-dashed px-4 text-sm text-[hsl(var(--muted-foreground))]">
          Team - add members
        </div>
      </section>
    );
  }

  if ((block.layout ?? "showcase") === "memberCards") {
    return (
      <EditorialTeamCards
        block={block}
        members={members}
        photoMap={photoMap}
      />
    );
  }

  if ((block.layout ?? "showcase") === "marqueeCards") {
    return (
      <MarqueeTeamCards
        block={block}
        members={members}
        photoMap={photoMap}
      />
    );
  }

  if ((block.layout ?? "showcase") === "creativeSection") {
    return (
      <CreativeTeamSection
        block={block}
        members={members}
        photoMap={photoMap}
      />
    );
  }

  const handlePointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") setActiveId(null);
  };

  return (
    <section className="team-showcase-block bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      {block.title.trim() && (
        <h2 className="mx-auto max-w-5xl px-4 pt-8 text-xs font-medium uppercase tracking-[0.24em] text-[hsl(var(--muted-foreground))] md:px-6">
          {block.title}
        </h2>
      )}
      <div
        className="mx-auto flex w-full max-w-5xl select-none flex-col items-start gap-8 px-4 py-8 font-sans md:flex-row md:gap-10 md:px-6 lg:gap-14"
        onPointerLeave={handlePointerLeave}
      >
        <div className="flex max-w-full shrink-0 gap-2 overflow-x-auto pb-1 md:gap-3 md:overflow-visible md:pb-0">
          {columns.map((column, columnIndex) => (
            <div
              key={columnIndex}
              className={cn(
                "flex shrink-0 flex-col",
                COLUMN_CLASSES[columnIndex % COLUMN_CLASSES.length].column,
              )}
            >
              {column.map((member, index) => {
                const photo = member.photoId ? photoMap.get(member.photoId) : undefined;
                const active = member.id === activeMemberId;
                const dimmed = activeMemberId !== null && !active;
                return (
                  <PortraitCard
                    key={member.id}
                    member={member}
                    photo={photo}
                    active={active}
                    dimmed={dimmed}
                    grayscale={block.grayscale !== false}
                    priority={columnIndex === 0 && index === 0}
                    className={COLUMN_CLASSES[columnIndex % COLUMN_CLASSES.length].card}
                    onActivate={() => setActiveId(member.id)}
                  />
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex w-full flex-1 flex-col gap-4 pt-0 sm:grid sm:grid-cols-2 md:flex md:flex-col md:gap-5 md:pt-2">
          {members.map((member) => {
            const active = member.id === activeMemberId;
            const dimmed = activeMemberId !== null && !active;
            return (
              <div
                key={member.id}
                className={cn(
                  "group transition-opacity duration-300 motion-reduce:transition-none",
                  dimmed ? "opacity-50" : "opacity-100",
                )}
                onMouseEnter={() => setActiveId(member.id)}
              >
                <span className="flex items-center">
                  <button
                    type="button"
                    className="flex min-w-0 cursor-pointer items-center text-left outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                    onPointerDown={() => setActiveId(member.id)}
                    onFocus={() => setActiveId(member.id)}
                    onClick={() => setActiveId(member.id)}
                    aria-current={active ? "true" : undefined}
                  >
                    <span
                      className={cn(
                        "mr-3 h-3 rounded-[5px] transition-all duration-300 motion-reduce:transition-none",
                        active
                          ? "w-5 bg-[hsl(var(--foreground))]"
                          : "w-4 bg-[hsl(var(--foreground))]/25",
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate text-base font-semibold leading-none tracking-tight md:text-[18px]">
                      {member.name || "Team member"}
                    </span>
                  </button>
                  {block.showSocials !== false && (
                    <SocialLinks member={member} active={active} />
                  )}
                </span>
                <button
                  type="button"
                  className="mt-1.5 block cursor-pointer pl-[27px] text-left text-[7px] font-medium uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))] outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] md:text-[10px]"
                  onPointerDown={() => setActiveId(member.id)}
                  onFocus={() => setActiveId(member.id)}
                  onClick={() => setActiveId(member.id)}
                  aria-label={`Show ${member.name}`}
                >
                  {member.role || "Role"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
