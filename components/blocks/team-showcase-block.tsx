"use client";

import {
  useMemo,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { ArrowRight } from "lucide-react";
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
