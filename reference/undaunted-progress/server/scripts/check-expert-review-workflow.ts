import {
  buildExpertReviewEvaluation,
  buildExpertReviewPack,
  parseExpertReviewCsv,
  serialiseExpertReviewCsv,
} from "../services/expert-review";

const comparisonSha256 = "a".repeat(64);
const candidatePoolSha256 = "b".repeat(64);

function matches(prefix: string) {
  return Array.from({ length: 10 }, (_, index) => ({
    rank: index + 1,
    investor: {
      id: `${prefix}-investor-${index + 1}`,
      organisation: `${prefix} Investor ${index + 1}`,
      description: "Fictional investor used by the offline workflow check.",
      investorType: ["VC"],
      investmentStage: ["Seed"],
      sectorFocus: ["Clean Energy"],
      regionalFocus: ["United Kingdom"],
      hqLocation: "London",
      minTicketSize: 50000,
      maxTicketSize: 500000,
      investmentInstruments: ["Equity"],
      investmentThesis: "Fictional ClimateTech thesis.",
    },
  }));
}

const comparison = {
  run: {
    schemaVersion: "normalisation-paired-comparison-v1",
    experimentId: "expert-review-self-check",
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
      amountRaising: 1200000,
      minTicketSize: 50000,
      investmentTypes: ["Equity"],
      roundGeography: "United Kingdom",
      roundSectors: ["Clean Energy"],
      preferredInvestorTypes: ["VC"],
    },
    profiles: [
      { normalisationProfile: "legacy", matches: matches(`legacy-${index}`) },
      {
        normalisationProfile: "normalisation-v1",
        matches: matches(`optimised-${index}`),
      },
    ],
  })),
};

function completedCsv(
  pack: ReturnType<typeof buildExpertReviewPack>,
  reviewerId: string,
  positiveThroughRank: number,
) {
  const itemById = new Map(
    pack.manifest.items.map(item => [item.reviewItemId, item]),
  );
  const rows = parseExpertReviewCsv(pack.csv).map(row => ({
    ...row,
    reviewer_id: reviewerId,
    thumbs_up:
      itemById.get(row.review_item_id)!.systemRank <= positiveThroughRank
        ? "up"
        : "down",
    review_comment: "Fictional workflow-check judgement.",
  }));
  return serialiseExpertReviewCsv(rows);
}

function main() {
  const baseline = buildExpertReviewPack({
    comparison,
    comparisonSha256,
    packId: "baseline-review-round",
    profile: "legacy",
    createdAt: "2026-08-03T00:00:00.000Z",
    fileName: "baseline-review.local.csv",
  });
  const optimised = buildExpertReviewPack({
    comparison,
    comparisonSha256,
    packId: "optimised-review-round",
    profile: "normalisation-v1",
    createdAt: "2026-08-03T00:00:00.000Z",
    fileName: "optimised-review.local.csv",
  });
  const evaluation = buildExpertReviewEvaluation({
    reviews: [
      {
        fileName: "baseline-returned.local.csv",
        csv: completedCsv(baseline, "reviewer-a", 3),
        manifest: baseline.manifest,
      },
      {
        fileName: "optimised-returned.local.csv",
        csv: completedCsv(optimised, "reviewer-a", 4),
        manifest: optimised.manifest,
      },
    ],
  });
  if (
    evaluation.reviewerCount !== 1
    || evaluation.aggregate.delta.thumbsUpAt5 !== 0.2
    || evaluation.aggregate.delta.thumbsUpAt10 !== 0.1
    || evaluation.aggregate.agreement !== null
  ) {
    throw new Error("Expert review workflow produced unexpected metrics.");
  }
  console.log("Expert paired-review workflow check passed.");
  console.log("Checked four funding rounds, staged packs, evidence integrity and P@5/P@10 deltas.");
}

try {
  main();
} catch (error) {
  console.error(
    `Expert review workflow check failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
}
