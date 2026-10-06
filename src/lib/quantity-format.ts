/**
 * Canonical formatter for quantity-style DC fields (RM QTY, EXP FG QTY, item
 * quantities): the numeric quantity plus the record's own unit of measure.
 * Weight is a distinct field (see formatWeightKg) and must never be
 * substituted here — quantity and weight are independent measurements.
 */
export function formatQuantity(
  value: number | string | { toString(): string } | null | undefined,
  uom: string | null | undefined,
  fallbackUom = "NOS",
): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  return `${num.toFixed(3)} ${uom || fallbackUom}`;
}

/** Canonical formatter for weight-in-KG fields (always KG, never a quantity UOM). */
export function formatWeightKg(value: number | string | { toString(): string } | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  return `${num} KG`;
}
