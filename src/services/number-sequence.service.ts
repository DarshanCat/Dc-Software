import type { Prisma } from "@prisma/client";

export interface SequenceOptions {
  key: string;
  fiscalYear: string;
  prefix?: string;
  padding?: number;
  /**
   * Optional availability check for the generated candidate. When provided,
   * numbers already present in the target table (seeded/imported/manual rows)
   * are skipped instead of causing a unique-constraint failure.
   */
  isTaken?: (candidate: string) => Promise<boolean>;
}

type Tx = Prisma.TransactionClient;

const MAX_SKIP = 10_000;

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

  let candidate = "";
  for (let skipped = 0; skipped <= MAX_SKIP; skipped++) {
    const updated = await tx.numberSequence.update({
      where: { key_fiscalYear: { key: opts.key, fiscalYear: opts.fiscalYear } },
      data: { current: { increment: 1 } },
    });
    candidate = `${prefix}${String(updated.current).padStart(padding, "0")}`;
    if (!opts.isTaken || !(await opts.isTaken(candidate))) return candidate;
  }

  throw new Error(`Unable to generate a free ${opts.key} number after ${MAX_SKIP} attempts.`);
}

export function fiscalYearOf(date: Date, fyStartMonth = 4): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return String(m >= fyStartMonth ? y : y - 1);
}
