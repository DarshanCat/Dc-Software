/**
 * classification.service.ts — pure internal Good/Scrap/Unclassified (spec §8, §10).
 * NO vendor-rejection concept. Unclassified = Received - Good - Scrap.
 */
import { D, sub, add, gt, lt, isZero, round } from "../lib/decimal";
import type { Numeric } from "../lib/decimal";

export interface ClassificationInput {
  receivedQty: Numeric;
  goodQty: Numeric;
  scrapQty: Numeric;
}

export interface ClassificationResult {
  receivedQty: string;
  goodQty: string;
  scrapQty: string;
  unclassifiedQty: string;
  fullyClassified: boolean;
  overClassified: boolean;
}

export function computeClassification(input: ClassificationInput): ClassificationResult {
  const received = D(input.receivedQty);
  const good = D(input.goodQty);
  const scrap = D(input.scrapQty);
  const classified = add(good, scrap);
  const unclassifiedRaw = sub(received, classified);
  const overClassified = gt(classified, received);
  const unclassified = lt(unclassifiedRaw, 0) ? D(0) : unclassifiedRaw;
  const fullyClassified = isZero(unclassified) && !overClassified;
  return {
    receivedQty: round(received).toFixed(3),
    goodQty: round(good).toFixed(3),
    scrapQty: round(scrap).toFixed(3),
    unclassifiedQty: round(unclassified).toFixed(3),
    fullyClassified,
    overClassified,
  };
}

export function rollupClassification(lines: ClassificationInput[]): ClassificationResult {
  const received = add(...(lines.length ? lines.map((l) => l.receivedQty) : [0]));
  const good = add(...(lines.length ? lines.map((l) => l.goodQty) : [0]));
  const scrap = add(...(lines.length ? lines.map((l) => l.scrapQty) : [0]));
  return computeClassification({ receivedQty: received, goodQty: good, scrapQty: scrap });
}