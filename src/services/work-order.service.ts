/**
 * work-order.service.ts — pure WO material balance + status (spec §15, §16).
 */
import { D, sub, gte, lt, isZero, gt, round } from "../lib/decimal";
import type { Numeric } from "../lib/decimal";

export type WoStatus =
  | "DRAFT" | "OPEN" | "WAITING_FOR_MATERIAL" | "READY_FOR_PROCESSING"
  | "PROCESSING" | "PARTIALLY_RETURNED" | "FULLY_RETURNED"
  | "RECONCILIATION" | "CLOSED" | "CANCELLED";

export interface WoBalanceInput {
  requiredInputQty: Numeric;
  totalSentQty: Numeric;
  expectedOutputQty: Numeric;
  totalReturnedQty: Numeric;
}

export interface WoBalance {
  requiredInputQty: string;
  totalSentQty: string;
  inputPendingQty: string;
  expectedOutputQty: string;
  totalReturnedQty: string;
  outputPendingQty: string;
  inputComplete: boolean;
  outputComplete: boolean;
  status: WoStatus;
}

export function computeWoBalance(input: WoBalanceInput): WoBalance {
  const required = D(input.requiredInputQty);
  const sent = D(input.totalSentQty);
  const expected = D(input.expectedOutputQty);
  const returned = D(input.totalReturnedQty);

  const inputPendingRaw = sub(required, sent);
  const inputPending = gt(inputPendingRaw, 0) ? inputPendingRaw : D(0);
  const outputPendingRaw = sub(expected, returned);
  const outputPending = gt(outputPendingRaw, 0) ? outputPendingRaw : D(0);

  const inputComplete = gte(sent, required);
  const outputComplete = gte(returned, expected) && !isZero(expected);

  let status: WoStatus;
  if (!inputComplete) status = "WAITING_FOR_MATERIAL";
  else if (isZero(returned)) status = "READY_FOR_PROCESSING";
  else if (lt(returned, expected)) status = "PARTIALLY_RETURNED";
  else status = "FULLY_RETURNED";

  return {
    requiredInputQty: round(required).toFixed(3),
    totalSentQty: round(sent).toFixed(3),
    inputPendingQty: round(inputPending).toFixed(3),
    expectedOutputQty: round(expected).toFixed(3),
    totalReturnedQty: round(returned).toFixed(3),
    outputPendingQty: round(outputPending).toFixed(3),
    inputComplete,
    outputComplete,
    status,
  };
}