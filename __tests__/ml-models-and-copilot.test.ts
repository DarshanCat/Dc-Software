import { describe, it, expect } from "vitest";
import { predictDelayRisk, detectDCAnomalies } from "@/analytics/ml-models";
import { generateQualityTrendInsight, generateDCWorkflowInsight } from "@/analytics/ai-copilot";

describe("ML Models & AI Copilot Governance", () => {
  it("exposes model governance metadata and handles insufficient data gracefully", () => {
    const insufficient = predictDelayRisk([2, 3], 5);
    expect(insufficient.governance.status).toBe("INSUFFICIENT_DATA");
    expect(insufficient.governance.modelName).toBe("DelayPredictionModel");

    const sufficient = predictDelayRisk([2, 3, 4, 3, 2], 8);
    expect(sufficient.governance.status).toBe("BASELINE_STATISTICAL");
    expect(sufficient.result.isHighRisk).toBe(true);
  });

  it("detects quality reconciliation balance anomalies without modifying records", () => {
    const anomalousDc = {
      actualInwardQty: 100,
      goodQty: 80,
      rejectionQty: 10,
      scrapQty: 5,
    };

    const anomalies = detectDCAnomalies(anomalousDc);
    expect(anomalies.length).toBe(1);
    expect(anomalies[0].anomalyType).toBe("QUALITY_RECONCILIATION_MISMATCH");
    expect(anomalies[0].hasAnomaly).toBe(true);
  });

  it("generates actionable AI Copilot insights for quality and workflow bottlenecks", () => {
    const qualityInsight = generateQualityTrendInsight(8.5, 500);
    expect(qualityInsight.topic).toBe("High Quality Rejection Alert");
    expect(qualityInsight.actionableRecommendation).toContain("Initiate process parameter audit");

    const workflowInsight = generateDCWorkflowInsight(8, 2);
    expect(workflowInsight.topic).toBe("Manager Approval Bottleneck");
    expect(workflowInsight.actionableRecommendation).toContain("Review pending Store-Verified DCs");
  });
});
