import { prisma } from "@/lib/db";

export interface ToleranceSettings {
  unaccountedTolerancePercentage: number;
  scrapTolerancePercentage: number;
  approvedProcessLossPercentage: number;
}

export const DEFAULT_TOLERANCE_SETTINGS: ToleranceSettings = {
  unaccountedTolerancePercentage: 0,
  scrapTolerancePercentage: 2,
  approvedProcessLossPercentage: 0,
};

type DbClient = typeof prisma;

export async function getToleranceSettings(db: DbClient = prisma): Promise<ToleranceSettings> {
  const rows = await db.systemSetting.findMany({
    where: {
      key: {
        in: [
          "unaccountedTolerancePercentage",
          "scrapTolerancePercentage",
          "approvedProcessLossPercentage",
        ],
      },
    },
  });

  const map = new Map(rows.map((r) => [r.key, Number(r.value)]));

  return {
    unaccountedTolerancePercentage:
      map.has("unaccountedTolerancePercentage") && !isNaN(map.get("unaccountedTolerancePercentage")!)
        ? map.get("unaccountedTolerancePercentage")!
        : DEFAULT_TOLERANCE_SETTINGS.unaccountedTolerancePercentage,
    scrapTolerancePercentage:
      map.has("scrapTolerancePercentage") && !isNaN(map.get("scrapTolerancePercentage")!)
        ? map.get("scrapTolerancePercentage")!
        : DEFAULT_TOLERANCE_SETTINGS.scrapTolerancePercentage,
    approvedProcessLossPercentage:
      map.has("approvedProcessLossPercentage") && !isNaN(map.get("approvedProcessLossPercentage")!)
        ? map.get("approvedProcessLossPercentage")!
        : DEFAULT_TOLERANCE_SETTINGS.approvedProcessLossPercentage,
  };
}
