"use client";

import { useMemo, useState, type PointerEvent } from "react";
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
    member.photoId ||
    member.twitterUrl.trim() ||
    member.linkedinUrl.trim() ||
    member.instagramUrl.trim() ||
    member.behanceUrl.trim()
  );
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
