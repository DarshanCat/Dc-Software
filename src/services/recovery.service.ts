/**
 * recovery.service.ts — pure recovery/boring (KG) logic (spec §11–§14).
 */
import { D, sub, add, gt, percentageOf, round, isZero } from "../lib/decimal";
import type { Numeric } from "../lib/decimal";

export interface RecoveryInput {
  sentWeight: Numeric;
  receivedWeight: Numeric;
}

export interface RecoveryResult {
  sentWeight: string;
  receivedWeight: string;
  pendingWeight: string;
  recoveryPercent: string | null;
}

export function computeRecovery(input: RecoveryInput): RecoveryResult {
  const sent = D(input.sentWeight);
  const received = D(input.receivedWeight);
  const pendingRaw = sub(sent, received);
  const pending = gt(pendingRaw, 0) ? pendingRaw : D(0);
  const pct = percentageOf(received, sent);
  return {
    sentWeight: round(sent).toFixed(3),
    receivedWeight: round(received).toFixed(3),
    pendingWeight: round(pending).toFixed(3),
    recoveryPercent: pct === null ? null : round(pct, 2).toFixed(2),
  };
}

export function sumReceipts(weights: Numeric[]): string {
  return round(add(...(weights.length ? weights : [0]))).toFixed(3);
}

export function recoveryWithinTolerance(input: RecoveryInput, tolerancePercentage: Numeric = 0): boolean {
  const sent = D(input.sentWeight);
  if (isZero(sent)) return true;
  const received = D(input.receivedWeight);
  const shortfall = sub(sent, received);
  if (!gt(shortfall, 0)) return true;
  const toleranceAbs = sent.times(D(tolerancePercentage)).dividedBy(100);
  return !gt(shortfall, toleranceAbs);
}