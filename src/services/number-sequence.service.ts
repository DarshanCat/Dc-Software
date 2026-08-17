import type { Prisma } from "@prisma/client";

export interface SequenceOptions {
  key: string;
  fiscalYear: string;
  prefix?: string;
  padding?: number;
}

type Tx = Prisma.TransactionClient;

export async function nextNumber(tx: Tx, opts: SequenceOptions): Promise<string> {
  const prefix = opts.prefix ?? `${opts.key}-${opts.fiscalYear}-`;
  const padding = opts.padding ?? 6;

  await tx.numberSequence.upsert({
    where: { key_fiscalYear: { key: opts.key, fiscalYear: opts.fiscalYear } },
    create: { key: opts.key, fiscalYear: opts.fiscalYear, prefix, padding, current: 0 },
    update: {},
  });

  await tx.$queryRaw`
    SELECT id FROM "NumberSequence"
    WHERE "key" = ${opts.key} AND "fiscalYear" = ${opts.fiscalYear}
    FOR UPDATE
  `;

  const updated = await tx.numberSequence.update({
    where: { key_fiscalYear: { key: opts.key, fiscalYear: opts.fiscalYear } },
    data: { current: { increment: 1 } },
  });

  return `${prefix}${String(updated.current).padStart(padding, "0")}`;
}

export function fiscalYearOf(date: Date, fyStartMonth = 4): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return String(m >= fyStartMonth ? y : y - 1);
}