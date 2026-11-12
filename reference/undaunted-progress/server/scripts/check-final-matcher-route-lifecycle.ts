import assert from "node:assert/strict";
import type {
  AirtableFundingRound,
  AirtableStartup,
  Investor,
} from "../services/airtable";
import { buildFeedbackMatchingConfigHash } from "../services/feedback-comparison-runner";
import type { FinalMatcherHandoff } from "../services/final-matcher-handoff";
import { completeFinalMatcherRouteLifecycle } from "../services/final-matcher-route-lifecycle";
import type { FinalMatcherRouteResult } from "../services/final-matcher-route-result";
import type { MatchProgress } from "../services/matching";
import { getDefaultMatchingConfig } from "../services/matching-config";
import type { SemanticScorer } from "../services/semantic-scorer";

const implementationCommitSha = "1".repeat(40);
const startup: AirtableStartup = {
  id: "startup-route-lifecycle",
  name: "Route lifecycle startup",
  description: "Builds software for industrial energy efficiency.",
};
const fundingRound: AirtableFundingRound = {
  id: "round-route-lifecycle",
  roundStage: "Seed",
  roundSectors: ["Energy"],
  roundGeography: "United Kingdom",
  investmentTypes: ["Equity"],
};
const investors: Investor[] = Array.from({ length: 4 }, (_, index) => ({
  id: `route-lifecycle-investor-${index + 1}`,
  organisation: `Route lifecycle investor ${index + 1}`,
  description: "Invests in early-stage industrial energy companies.",
  investmentStage: ["Seed"],
  sectorFocus: ["Energy"],
  regionalFocus: ["United Kingdom"],
  investmentInstruments: ["Equity"],
}));

function handoff(): FinalMatcherHandoff {
  const config = getDefaultMatchingConfig();
  return {
    schemaVersion: "final-matcher-handoff-v1",
    createdAt: "2026-07-31T09:00:00.000Z",
    batchId: "fictional-route-lifecycle",
    selectedMethod: "no_feedback_gpt",
    semanticMethod: "gpt-semantic",
    aiModel: config.aiModel,
    matchingConfigHash: buildFeedbackMatchingConfigHash(config),
    feedbackSetHash: "f".repeat(64),
    implementationCommitSha,
    evaluation: {
      evidencePattern: "mixed",
      recommendation: "keep-control",
      reviewOutcome: "keep-control",
    },
    sources: {
      receipt: {
        fileName: "route-lifecycle.local.receipt.json",
        sha256: "a".repeat(64),
      },
      decision: {
        fileName: "route-lifecycle.local.decision.json",
        sha256: "b".repeat(64),
      },
      visualisation: {
        fileName: "route-lifecycle.local.visualisation.json",
        sha256: "c".repeat(64),
      },
      errorReview: {
        fileName: "route-lifecycle.local.error-review.json",
        sha256: "d".repeat(64),
      },
    },
    resultContract: {
      investor: true,
      scoreBreakdown: [
        "stageMatch",
        "ticketSizeMatch",
        "sectorOverlap",
        "geographyMatch",
        "instrumentMatch",
        "semanticScore",
        "totalScore",
      ],
      matchReasons: true,
      aiInsight: true,
    },
    status: "ready-for-runtime-integration",
  };
}

const scorer: SemanticScorer = async () => ({
  score: 72,
  exclusion_found: false,
  insight: "Lifecycle check insight",
});

function input(onProgress: (progress: MatchProgress) => void) {
  return {
    handoff: handoff(),
    implementationCommitSha,
    startup,
    fundingRound,
    investors,
    config: getDefaultMatchingConfig(),
    maxFeedbackContextCharacters: 2000,
    onProgress,
  };
}

async function main() {
  const progress: MatchProgress[] = [];
  const order: string[] = [];
  const saved: FinalMatcherRouteResult[] = [];
  const notified: FinalMatcherRouteResult[] = [];
  const investorsBefore = JSON.stringify(investors);
  const completed = await completeFinalMatcherRouteLifecycle(
    input(event => {
      progress.push(event);
      if (event.phase === "complete") order.push("complete");
    }),
    {
      semanticScorer: scorer,
      saveResult: async result => {
        assert.ok(progress.every(event => event.phase !== "complete"));
        saved.push(result);
        order.push("save");
      },
      notifyMatch: async result => {
        assert.equal(progress.at(-1)?.phase, "complete");
        notified.push(result);
        order.push("notify");
      },
    },
  );
  assert.deepEqual(order, ["save", "complete", "notify"]);
  assert.deepEqual(completed.effects, {
    save: "complete",
    notify: "complete",
  });
  assert.equal(completed.result.startupAirtableId, startup.id);
  assert.equal(completed.result.fundingRoundAirtableId, fundingRound.id);
  assert.equal(completed.result.matches.length, investors.length);
  assert.equal(saved[0], completed.result);
  assert.equal(notified[0], completed.result);
  assert.equal(
    progress.filter(event => event.phase === "complete").length,
    1,
  );
  assert.equal(JSON.stringify(investors), investorsBefore);

  const failedProgress: MatchProgress[] = [];
  const effectErrors: string[] = [];
  const failedEffects = await completeFinalMatcherRouteLifecycle(
    input(event => failedProgress.push(event)),
    {
      semanticScorer: scorer,
      saveResult: async () => {
        throw new Error("fictional save failure");
      },
      notifyMatch: async () => {
        throw new Error("fictional notification failure");
      },
      onEffectError: (effect, error) => {
        effectErrors.push(
          `${effect}:${error instanceof Error ? error.message : "unknown"}`,
        );
        if (effect === "notify") {
          throw new Error("fictional observer failure");
        }
      },
    },
  );
  assert.deepEqual(failedEffects.effects, {
    save: "failed",
    notify: "failed",
  });
  assert.deepEqual(effectErrors, [
    "save:fictional save failure",
    "notify:fictional notification failure",
  ]);
  assert.equal(failedProgress.at(-1)?.phase, "complete");

  let sideEffectsCalled = false;
  const invalidProgress: MatchProgress[] = [];
  await assert.rejects(
    completeFinalMatcherRouteLifecycle(
      {
        ...input(event => invalidProgress.push(event)),
        config: {
          ...getDefaultMatchingConfig(),
          weights: {
            ...getDefaultMatchingConfig().weights,
            semantic: 0.2,
          },
        },
      },
      {
        semanticScorer: scorer,
        saveResult: async () => {
          sideEffectsCalled = true;
        },
        notifyMatch: async () => {
          sideEffectsCalled = true;
        },
      },
    ),
    /configuration does not match/,
  );
  assert.equal(sideEffectsCalled, false);
  assert.ok(invalidProgress.every(event => event.phase !== "complete"));

  console.log("Final matcher route lifecycle check passed.");
  console.log(
    "Checked save-complete-notify order, non-fatal effects, route fields and rejected matcher failures.",
  );
}

main().catch(error => {
  console.error(
    `Final matcher route lifecycle check failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
});
