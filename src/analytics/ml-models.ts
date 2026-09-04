/**
 * ML Predictive Models & Anomaly Detection Architecture.
 * IMPORTANT: ML predictions expose model governance metadata and must NEVER modify actual transactional data or OMS facts.
 */

export type ModelGovernanceStatus = "TRAINED" | "BASELINE_STATISTICAL" | "INSUFFICIENT_DATA";

export interface PredictionMetadata {
  modelName: string;
  modelVersion: string;
  status: ModelGovernanceStatus;
  confidenceScore: number;
  timestamp: string;
  dataQuality: "HIGH" | "MEDIUM" | "LOW";
  contributingFactors: string[];
}

export interface PredictionResult<T> {
  result: T;
  governance: PredictionMetadata;
}

export function predictDelayRisk(historicalDays: number[], currentAgeDays: number): PredictionResult<{ delayRiskScore: number; isHighRisk: boolean }> {
  if (!historicalDays || historicalDays.length < 3) {
    return {
      result: { delayRiskScore: 0, isHighRisk: false },
      governance: {
        modelName: "DelayPredictionModel",
        modelVersion: "v1.0-statistical",
        status: "INSUFFICIENT_DATA",
        confidenceScore: 0.3,
        timestamp: new Date().toISOString(),
        dataQuality: "LOW",
        contributingFactors: ["Fewer than 3 historical DC return records available"],
      },
    };
  }

  const avgDays = historicalDays.reduce((a, b) => a + b, 0) / historicalDays.length;
  const maxThreshold = avgDays * 1.25;
  const isHighRisk = currentAgeDays > maxThreshold;
  const delayRiskScore = Math.min(1.0, Number((currentAgeDays / Math.max(1, avgDays)).toFixed(2)));

  return {
    result: { delayRiskScore, isHighRisk },
    governance: {
      modelName: "DelayPredictionModel",
      modelVersion: "v1.0-statistical",
      status: "BASELINE_STATISTICAL",
      confidenceScore: 0.85,
      timestamp: new Date().toISOString(),
      dataQuality: "HIGH",
      contributingFactors: [
        `Average historical return days: ${avgDays.toFixed(1)} days`,
        `Current DC elapsed duration: ${currentAgeDays} days`,
      ],
    },
  };
}

export function detectDCAnomalies(dc: {
  actualInwardQty?: number | null;
  goodQty?: number | null;
  rejectionQty?: number | null;
  scrapQty?: number | null;
  outwardWeight?: number | null;
  inwardGatingWeight?: number | null;
  rmQuantity?: number | null;
  returnFgQuantity?: number | null;
}): { hasAnomaly: boolean; anomalyType?: string; description?: string }[] {
  const anomalies: { hasAnomaly: boolean; anomalyType?: string; description?: string }[] = [];

  // Quality Balance Anomaly
  if (dc.actualInwardQty != null && (dc.goodQty != null || dc.rejectionQty != null || dc.scrapQty != null)) {
    const total = (dc.goodQty || 0) + (dc.rejectionQty || 0) + (dc.scrapQty || 0);
    if (Math.abs(Number(dc.actualInwardQty) - total) > 0.001) {
      anomalies.push({
        hasAnomaly: true,
        anomalyType: "QUALITY_RECONCILIATION_MISMATCH",
        description: `Good (${dc.goodQty || 0}) + Rejection (${dc.rejectionQty || 0}) + Scrap (${dc.scrapQty || 0}) = ${total}, which does not equal Actual Inward Qty (${dc.actualInwardQty}).`,
      });
    }
  }

  // Weight Discrepancy Anomaly (> 15% variance between outward and inward gate weight)
  if (dc.outwardWeight != null && dc.inwardGatingWeight != null && dc.outwardWeight > 0) {
    const variancePct = Math.abs((dc.inwardGatingWeight - dc.outwardWeight) / dc.outwardWeight) * 100;
    if (variancePct > 15) {
      anomalies.push({
        hasAnomaly: true,
        anomalyType: "WEIGHT_DISCREPANCY_EXCEEDED",
        description: `Significant gate weight variance: Outward ${dc.outwardWeight} KG vs Inward ${dc.inwardGatingWeight} KG (${variancePct.toFixed(1)}% variance).`,
      });
    }
  }

  return anomalies;
}
