import {
  parseExpertReviewCsv,
  serialiseExpertReviewCsv,
} from "../services/expert-review";
import {
  buildPooledExpertReviewEvaluation,
  buildPooledExpertReviewPack,
  parsePooledExpertReviewManifest,
} from "../services/pooled-expert-review";

const comparisonSha256 = "a".repeat(64);
const candidatePoolSha256 = "b".repeat(64);
const configHashes = {
  legacy: "c".repeat(64),
  "normalisation-v1": "d".repeat(64),
};

function investor(id: string) {
  return {
    id,
    organisation: `Fictional ${id}`,
    description: "Fictional investor used by the offline pooled workflow check.",
    investorType: ["VC"],
    investmentStage: ["Seed"],
    sectorFocus: ["Clean Energy"],
    regionalFocus: ["United Kingdom"],
    hqLocation: "London",
    minTicketSize: 50_000,
    maxTicketSize: 500_000,
    investmentInstruments: ["Equity"],
    investmentThesis: "Fictional ClimateTech thesis.",
  };
}

function matches(caseIndex: number, profile: "legacy" | "normalisation-v1") {
  return Array.from({ length: 10 }, (_, index) => {
    const rank = index + 1;
    const id = rank <= 3
      ? `case-${caseIndex}-shared-${rank}`
      : `case-${caseIndex}-${profile}-${rank}`;
    return {
      rank,
      investor: investor(id),
      scores: { totalScore: 90 - rank },
    };
  });
}

const comparison = {
  run: {
    schemaVersion: "normalisation-paired-comparison-v1",
    experimentId: "pooled-expert-review-self-check",
    topK: 10,
    queryCount: 4,
    candidatePool: { candidatePoolSha256 },
  },
  queries: [1, 2, 3, 4].map(index => ({
    queryId: `query-${index}`,
    startupId: `startup-${index}`,
    fundingRoundId: `round-${index}`,
    reviewContext: {
      startupName: `Fictional Startup ${index}`,
      description: "Fictional startup description.",
      climateProblem: "Industrial emissions.",
      solutionDescription: "Planning software.",
      businessModel: "SaaS",
      targetMarket: "Industrial operators",
      tractionSummary: "Three fictional pilots.",
      unfairAdvantage: "Fictional domain data.",
      tweetPitch: "Fictional heat planning.",
      roundStage: "Seed",
      amountRaising: 1_200_000,
      minTicketSize: 50_000,
      investmentTypes: ["Equity"],
      roundGeography: "United Kingdom",
      roundSectors: ["Clean Energy"],
      preferredInvestorTypes: ["VC"],
    },
    profiles: [
      {
        normalisationProfile: "legacy",
        configSha256: configHashes.legacy,
        matches: matches(index, "legacy"),
      },
      {
        normalisationProfile: "normalisation-v1",
        configSha256: configHashes["normalisation-v1"],
        matches: matches(index, "normalisation-v1"),
      },
    ],
  })),
};

function complete(
  pack: ReturnType<typeof buildPooledExpertReviewPack>,
  reviewerId: string,
) {
  const itemById = new Map(
    pack.manifest.items.map(item => [item.reviewItemId, item]),
  );
  const rows = parseExpertReviewCsv(pack.csv).map(row => {
    const item = itemById.get(row.review_item_id)!;
    const thumbsUp = item.sources.some(
      source =>
        source.systemRank <= 3
        || (source.profile === "normalisation-v1" && source.systemRank === 4),
    );
    return {
      ...row,
      reviewer_id: reviewerId,
      thumbs_up: thumbsUp ? "up" : "down",
      review_comment: "Fictional pooled workflow-check judgement.",
    };
  });
  return serialiseExpertReviewCsv(rows);
}

function main() {
  const args = {
    comparison,
    comparisonSha256,
    packId: "pooled-review-self-check",
    createdAt: "2026-08-12T00:00:00.000Z",
    fileName: "pooled-review.local.csv",
  };
  const first = buildPooledExpertReviewPack(args);
  const second = buildPooledExpertReviewPack(args);
  if (first.csv !== second.csv || first.manifest.rowCount !== 68) {
    throw new Error("Pooled pack is not deterministic or did not deduplicate correctly.");
  }
  const headers = first.csv.slice(0, first.csv.indexOf("\n"));
  if (/normalisation|profile|systemRank|system_score|systemScore/.test(headers)) {
    throw new Error("Reviewer CSV leaked algorithm, rank or score fields.");
  }
  const manifest = parsePooledExpertReviewManifest(first.manifest);
  if (!manifest.items.some(item => item.sources.length === 2)) {
    throw new Error("Pooled manifest did not retain shared-investor provenance.");
  }
  const evaluation = buildPooledExpertReviewEvaluation({
    reviews: [
      {
        fileName: "pooled-review-returned.local.csv",
        csv: `\uFEFF${complete(first, "reviewer-a")}`,
        manifest,
      },
    ],
  });
  if (
    evaluation.reviewerCount !== 1
    || evaluation.aggregate.profiles.legacy.thumbsUpAt5 !== 0.6
    || evaluation.aggregate.profiles["normalisation-v1"].thumbsUpAt5 !== 0.8
    || evaluation.aggregate.delta.thumbsUpAt5 !== 0.2
    || evaluation.aggregate.delta.thumbsUpAt10 !== 0.1
  ) {
    throw new Error(
      `Pooled review evaluation produced unexpected metrics: ${JSON.stringify(evaluation.aggregate)}.`,
    );
  }
  console.log("Algorithm-blinded pooled expert-review workflow check passed.");
  console.log("Checked four cases, UTF-8 BOM handling, stable-ID deduplication, deterministic shuffle, evidence integrity and paired P@5/P@10 deltas.");
}

try {
  main();
} catch (error) {
  console.error(
    `Pooled expert-review workflow check failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
}
