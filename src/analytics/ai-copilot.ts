/**
 * AI Copilot explanation hooks.
 * Explains manufacturing trends, delay causes, rejection risks, and pending approval bottlenecks.
 * MUST NEVER modify actual transactional data or OMS facts.
 */

export interface CopilotInsight {
  topic: string;
  explanation: string;
  actionableRecommendation: string;
  sourceMetrics: Record<string, any>;
}

export function generateQualityTrendInsight(rejectionRatePct: number, totalInspected: number): CopilotInsight {
  if (totalInspected === 0) {
    return {
      topic: "Quality Trend Analysis",
      explanation: "No recent material quality inspections recorded.",
      actionableRecommendation: "Perform quality inspections on pending Store Confirmed DCs.",
      sourceMetrics: { rejectionRatePct: 0, totalInspected: 0 },
    };
  }

  if (rejectionRatePct > 5.0) {
    return {
      topic: "High Quality Rejection Alert",
      explanation: `Current rejection rate is elevated at ${rejectionRatePct}% across ${totalInspected} inspected items.`,
      actionableRecommendation: "Initiate process parameter audit for vendors exhibiting high rejection rates.",
      sourceMetrics: { rejectionRatePct, totalInspected },
    };
  }

  return {
    topic: "Quality Trend Analysis",
    explanation: `Quality performance is within acceptable thresholds with a ${rejectionRatePct}% rejection rate over ${totalInspected} items.`,
    actionableRecommendation: "Maintain current process controls and store verification protocols.",
    sourceMetrics: { rejectionRatePct, totalInspected },
  };
}

export function generateDCWorkflowInsight(pendingManagerCount: number, pendingStoreCount: number): CopilotInsight {
  if (pendingManagerCount > 5) {
    return {
      topic: "Manager Approval Bottleneck",
      explanation: `There are ${pendingManagerCount} Delivery Challans currently waiting for Manager Final Approval.`,
      actionableRecommendation: "Review pending Store-Verified DCs in the Manager Approval Portal to prevent payment processing delays.",
      sourceMetrics: { pendingManagerCount, pendingStoreCount },
    };
  }

  return {
    topic: "DC Workflow Balance",
    explanation: `Workflow queue is operating normally (${pendingManagerCount} pending Manager Approval, ${pendingStoreCount} pending Store Verification).`,
    actionableRecommendation: "Continue routine daily gate and store confirmations.",
    sourceMetrics: { pendingManagerCount, pendingStoreCount },
  };
}
