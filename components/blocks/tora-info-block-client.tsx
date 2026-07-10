"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { cn } from "@/src/lib/utils";

export interface ToraInfoTabViewItem {
  id: string;
  title: string;
  text: string;
  photo?: PhotoDTO | null;
  accentPhoto?: PhotoDTO | null;
}

export interface ToraInfoAccordionItem {
  id: string;
  title: string;
  text: string;
}

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

export function ToraInfoTabs({
  eyebrow,
  text,
  items,
}: {
  eyebrow: string;
  text: string;
  items: ToraInfoTabViewItem[];
}) {
  const tabs = useMemo(
    () => items.filter((item) => item.title.trim() || item.text.trim() || item.photo),
    [items],
  );
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (activeIndex < tabs.length) return;
    setActiveIndex(0);
  }, [activeIndex, tabs.length]);

  if (tabs.length === 0) return null;

  const active = tabs[activeIndex] ?? tabs[0];
  const tabPanelId = `tora-info-tab-panel-${active.id}`;

  return (
    <div className="tora-info-tabs">
      <div className="tora-info-tabs__intro">
        {eyebrow.trim() && <p className="tora-info-tabs__subtitle">{eyebrow}</p>}
        {text.trim() && (
          <div className="tora-info-tabs__intro-text">
            <Paragraphs text={text} />
          </div>
        )}
        <div
          className="tora-info-tabs__nav"
          role="tablist"
          aria-label="Info categories"
        >
          {tabs.map((item, index) => {
            const selected = index === activeIndex;
            const tabId = `tora-info-tab-${item.id}`;
            return (
              <button
                key={item.id}
                id={tabId}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={selected ? tabPanelId : `tora-info-tab-panel-${item.id}`}
                className={cn("tora-info-tabs__tab", selected && "is-active")}
                onClick={() => setActiveIndex(index)}
              >
                {item.title || `Tab ${index + 1}`}
              </button>
            );
          })}
        </div>
      </div>

      <div className="tora-info-tabs__showcase">
        <div className="tora-info-tabs__image">
          {active.photo ? (
            <ResponsiveImage
              photo={active.photo}
              sizes="(max-width: 991px) 100vw, 42vw"
              className="h-full w-full"
            />
          ) : (
            <div className="tora-info-image-placeholder" aria-hidden="true" />
          )}
          {active.accentPhoto && (
            <div className="tora-info-tabs__accent" aria-hidden="true">
              <ResponsiveImage
                photo={active.accentPhoto}
                sizes="130px"
                className="h-full w-full"
              />
            </div>
          )}
        </div>
        <div
          id={tabPanelId}
          className="tora-info-tabs__panel"
          role="tabpanel"
          aria-labelledby={`tora-info-tab-${active.id}`}
        >
          {active.title.trim() && (
            <h3 className="tora-info-tabs__heading">{active.title}</h3>
          )}
          {active.text.trim() && (
            <div className="tora-info-tabs__body">
              <Paragraphs text={active.text} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ToraInfoAccordion({ items }: { items: ToraInfoAccordionItem[] }) {
  const rows = useMemo(
    () => items.filter((item) => item.title.trim() || item.text.trim()),
    [items],
  );
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (activeIndex < rows.length) return;
    setActiveIndex(0);
  }, [activeIndex, rows.length]);

  if (rows.length === 0) return null;

  return (
    <div className="tora-info-accordion">
      {rows.map((item, index) => {
        const isOpen = index === activeIndex;
        const panelId = `tora-info-accordion-panel-${item.id}`;
        const buttonId = `tora-info-accordion-button-${item.id}`;
        return (
          <div
            key={item.id}
            className={cn("tora-info-accordion__item", isOpen && "is-open")}
          >
            <button
              id={buttonId}
              type="button"
              className="tora-info-accordion__button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setActiveIndex(isOpen ? -1 : index)}
            >
              <span>{item.title || `Row ${index + 1}`}</span>
              <span className="tora-info-accordion__mark" aria-hidden="true" />
            </button>
            <div
              id={panelId}
              className="tora-info-accordion__panel"
              role="region"
              aria-labelledby={buttonId}
            >
              <div className="tora-info-accordion__body">
                <Paragraphs text={item.text} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
