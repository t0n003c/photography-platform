export interface ProductOptionValue {
  id: string;
  label: string;
  priceDeltaCents: number;
}

export interface ProductOption {
  id: string;
  name: string;
  required: boolean;
  values: ProductOptionValue[];
}

export type ProductOptionSelectionInput = Record<string, string>;

export interface SelectedProductOption {
  optionId: string;
  optionName: string;
  valueId: string;
  valueLabel: string;
  priceDeltaCents: number;
}

export interface CartOptionError {
  productId: string;
  optionId?: string;
  message: string;
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueId(base: string, used: Set<string>, fallback: string): string {
  const root = slugify(base) || fallback;
  let candidate = root;
  let index = 2;
  while (used.has(candidate)) {
    candidate = `${root}-${index}`;
    index += 1;
  }
  used.add(candidate);
  return candidate;
}

export function createStoreOptionId(prefix: "option" | "value" = "option") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeProductOptions(input: unknown): ProductOption[] {
  if (!Array.isArray(input)) return [];
  const optionIds = new Set<string>();
  return input
    .map((raw, optionIndex) => {
      if (!raw || typeof raw !== "object") return null;
      const record = raw as Record<string, unknown>;
      const name = cleanText(record.name);
      if (!name) return null;
      const optionId = uniqueId(
        cleanText(record.id) || name,
        optionIds,
        `option-${optionIndex + 1}`,
      );
      const valueIds = new Set<string>();
      const values = (Array.isArray(record.values) ? record.values : [])
        .map((rawValue, valueIndex) => {
          if (!rawValue || typeof rawValue !== "object") return null;
          const valueRecord = rawValue as Record<string, unknown>;
          const label = cleanText(valueRecord.label);
          if (!label) return null;
          const parsedDelta = Number(valueRecord.priceDeltaCents ?? 0);
          const priceDeltaCents = Number.isFinite(parsedDelta)
            ? Math.round(parsedDelta)
            : 0;
          return {
            id: uniqueId(
              cleanText(valueRecord.id) || label,
              valueIds,
              `value-${valueIndex + 1}`,
            ),
            label,
            priceDeltaCents,
          };
        })
        .filter((value): value is ProductOptionValue => Boolean(value));

      if (values.length === 0) return null;
      return {
        id: optionId,
        name,
        required: record.required !== false,
        values,
      };
    })
    .filter((option): option is ProductOption => Boolean(option));
}

export function normalizeOptionSelection(input: unknown): ProductOptionSelectionInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>)
      .map(([key, value]) => [key.trim(), cleanText(value)])
      .filter(([key, value]) => key && value),
  );
}

export function optionSelectionKey(input: unknown): string {
  const selection = normalizeOptionSelection(input);
  return Object.entries(selection)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([optionId, valueId]) => `${optionId}:${valueId}`)
    .join("|");
}

export function selectedOptionsLabel(options: SelectedProductOption[]): string {
  return options
    .map((option) => `${option.optionName}: ${option.valueLabel}`)
    .join(", ");
}

export function normalizeSelectedOptions(input: unknown): SelectedProductOption[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const record = raw as Record<string, unknown>;
      const optionId = cleanText(record.optionId);
      const optionName = cleanText(record.optionName);
      const valueId = cleanText(record.valueId);
      const valueLabel = cleanText(record.valueLabel);
      if (!optionId || !optionName || !valueId || !valueLabel) return null;
      const parsedDelta = Number(record.priceDeltaCents ?? 0);
      return {
        optionId,
        optionName,
        valueId,
        valueLabel,
        priceDeltaCents: Number.isFinite(parsedDelta) ? Math.round(parsedDelta) : 0,
      };
    })
    .filter((option): option is SelectedProductOption => Boolean(option));
}
