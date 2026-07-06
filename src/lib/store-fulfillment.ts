export interface OrderPackingChecklistEntry {
  itemId: string;
  checked: boolean;
  checkedAt: string | null;
  checkedBy: string | null;
}

export function normalizePackingChecklist(
  input: unknown,
): OrderPackingChecklistEntry[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const entries: OrderPackingChecklistEntry[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const itemId = typeof row.itemId === "string" ? row.itemId.trim() : "";
    if (!itemId || seen.has(itemId)) continue;
    seen.add(itemId);
    entries.push({
      itemId,
      checked: row.checked === true,
      checkedAt: typeof row.checkedAt === "string" ? row.checkedAt : null,
      checkedBy: typeof row.checkedBy === "string" ? row.checkedBy : null,
    });
  }
  return entries;
}
