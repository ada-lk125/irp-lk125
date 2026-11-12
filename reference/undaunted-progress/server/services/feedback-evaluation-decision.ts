import type { FeedbackEvaluationReceipt } from "./feedback-evaluation-receipt";

export const FEEDBACK_EVALUATION_DECISION_SCHEMA_VERSION =
  "feedback-evaluation-decision-v1";

export type FeedbackMetricName =
  | "precisionAt5"
  | "precisionAt10"
  | "mrr"
  | "ndcgAt10";

export type FeedbackMetricDirection = "improved" | "unchanged" | "regressed";

export interface FeedbackMetricDelta {
  metric: FeedbackMetricName;
  none: number;
  curated: number;
  delta: number;
  direction: FeedbackMetricDirection;
}

export interface FeedbackEvaluationDecision {
  schemaVersion: typeof FEEDBACK_EVALUATION_DECISION_SCHEMA_VERSION;
  batchId: string;
  queryIds: string[];
  metricDeltas: FeedbackMetricDelta[];
  evidencePattern:
    | "consistent-improvement"
    | "mixed"
    | "no-measured-change"
    | "consistent-regression";
  recommendation: "review-curated-candidate" | "keep-control";
  reviewStatus: "requires-error-review";
}

const METRICS: FeedbackMetricName[] = [
  "precisionAt5",
  "precisionAt10",
  "mrr",
  "ndcgAt10",
];

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function direction(delta: number): FeedbackMetricDirection {
  if (delta > 0) return "improved";
  if (delta < 0) return "regressed";
  return "unchanged";
}

function evidencePattern(
  deltas: readonly FeedbackMetricDelta[],
): FeedbackEvaluationDecision["evidencePattern"] {
  const directions = new Set(deltas.map(item => item.direction));
  if (directions.size === 1 && directions.has("unchanged")) {
    return "no-measured-change";
  }
  if (!directions.has("regressed") && directions.has("improved")) {
    return "consistent-improvement";
  }
  if (!directions.has("improved") && directions.has("regressed")) {
    return "consistent-regression";
  }
  return "mixed";
}

export function buildFeedbackEvaluationDecision(
  receipt: FeedbackEvaluationReceipt,
): FeedbackEvaluationDecision {
  if (receipt.decisionStatus !== "ready-for-review") {
    throw new Error("The feedback evaluation receipt is not ready for review.");
  }
  const [none, curated] = receipt.runs;
  if (none.feedbackMode !== "none" || curated.feedbackMode !== "curated") {
    throw new Error("The feedback evaluation receipt must contain none, then curated.");
  }

  const metricDeltas = METRICS.map(metric => {
    const noneValue = none.metrics[metric];
    const curatedValue = curated.metrics[metric];
    const delta = round(curatedValue - noneValue);
    return {
      metric,
      none: noneValue,
      curated: curatedValue,
      delta,
      direction: direction(delta),
    };
  });
  const pattern = evidencePattern(metricDeltas);

  return {
    schemaVersion: FEEDBACK_EVALUATION_DECISION_SCHEMA_VERSION,
    batchId: receipt.batch.batchId,
    queryIds: [...receipt.queryIds],
    metricDeltas,
    evidencePattern: pattern,
    recommendation: pattern === "consistent-improvement"
      ? "review-curated-candidate"
      : "keep-control",
    reviewStatus: "requires-error-review",
  };
}
