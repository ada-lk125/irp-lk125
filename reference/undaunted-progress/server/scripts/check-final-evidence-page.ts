import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FeedbackEvaluationVisualisationManifest } from "../services/feedback-evaluation-visualisation";
import {
  buildFinalEvidencePage,
  hashFinalEvidenceSource,
  writeFinalEvidencePage,
} from "../services/final-evidence-page";
import type { FinalMatcherHandoff } from "../services/final-matcher-handoff";
import type { FinalRankingMovementManifest } from "../services/final-ranking-movement";

const createdAt = "2026-07-30T12:00:00.000Z";
const matchingConfigHash = "b".repeat(64);
const feedbackSetHash = "c".repeat(64);
const implementationCommitSha = "1".repeat(40);

function hash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function source(fileName: string, text: string) {
  return { fileName, sha256: hashFinalEvidenceSource(text) };
}

const metricSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="420" viewBox="0 0 900 420" role="img" aria-labelledby="title description">
<title id="title">Feedback ablation evaluation</title>
<desc id="description">Fictional frozen metric comparison.</desc>
<rect width="900" height="420" fill="#ffffff"/>
<text x="40" y="70">Precision@5</text>
<text x="240" y="70">Precision@10</text>
<text x="480" y="70">MRR</text>
<text x="650" y="70">NDCG@10</text>
</svg>
`;

const metricManifest: FeedbackEvaluationVisualisationManifest = {
  schemaVersion: "feedback-evaluation-visualisation-v1",
  batchId: "fictional-final-evidence",
  aiModel: "gpt-4o-mini",
  matchingConfigHash,
  implementationCommitSha,
  metricFiles: {
    none: {
      fileName: "fictional-none.local.metrics.json",
      sha256: "2".repeat(64),
    },
    curated: {
      fileName: "fictional-curated.local.metrics.json",
      sha256: "3".repeat(64),
    },
  },
  decision: {
    evidencePattern: "consistent-improvement",
    recommendation: "review-curated-candidate",
    reviewStatus: "requires-error-review",
  },
  svg: {
    fileName: "fictional-metrics.local.svg",
    sha256: hash(metricSvg),
  },
};
const metricManifestText = json(metricManifest);
const metricManifestSource = source(
  "fictional-metrics.local.visualisation.json",
  metricManifestText,
);

const handoff: FinalMatcherHandoff = {
  schemaVersion: "final-matcher-handoff-v1",
  createdAt,
  batchId: "fictional-final-evidence",
  selectedMethod: "curated_feedback",
  semanticMethod: "gpt-semantic",
  aiModel: "gpt-4o-mini",
  matchingConfigHash,
  feedbackSetHash,
  implementationCommitSha,
  evaluation: {
    evidencePattern: "consistent-improvement",
    recommendation: "review-curated-candidate",
    reviewOutcome: "approve-curated",
  },
  sources: {
    receipt: {
      fileName: "fictional.local.receipt.json",
      sha256: "4".repeat(64),
    },
    decision: {
      fileName: "fictional.local.decision.json",
      sha256: "5".repeat(64),
    },
    visualisation: metricManifestSource,
    errorReview: {
      fileName: "fictional.local.error-review.json",
      sha256: "6".repeat(64),
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
const handoffText = json(handoff);
const handoffSource = source(
  "fictional.local.final-matcher.json",
  handoffText,
);

function rankingFixture(
  queryAlias: "Q1" | "Q2" | "Q3",
  hashCharacter: "7" | "8" | "9",
) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="420" viewBox="0 0 900 420" role="img" aria-labelledby="title description">
<title id="title">Final ranking movement for ${queryAlias}</title>
<desc id="description">Fictional anonymous ranking movement.</desc>
<rect width="900" height="420" fill="#ffffff"/>
<text x="40" y="70">${queryAlias}: I001 I002 I003</text>
</svg>
`;
  const manifest: FinalRankingMovementManifest = {
    schemaVersion: "final-ranking-movement-v1",
    createdAt,
    queryAlias,
    selectedMethod: "curated_feedback",
    aiModel: "gpt-4o-mini",
    matchingConfigHash,
    feedbackSetHash,
    implementationCommitSha,
    topN: 3,
    candidatePoolHash: hashCharacter.repeat(64),
    sources: {
      baseline: {
        fileName: `${queryAlias.toLowerCase()}-baseline.local.json`,
        sha256: "a".repeat(64),
      },
      selected: {
        fileName: `${queryAlias.toLowerCase()}-selected.local.json`,
        sha256: "d".repeat(64),
      },
      handoff: handoffSource,
    },
    summary: {
      up: 1,
      down: 1,
      same: 1,
      entered: 0,
      left: 0,
    },
    rows: [
      {
        investorAlias: "I001",
        baselineRank: 1,
        selectedRank: 2,
        movement: "down",
      },
      {
        investorAlias: "I002",
        baselineRank: 2,
        selectedRank: 1,
        movement: "up",
      },
      {
        investorAlias: "I003",
        baselineRank: 3,
        selectedRank: 3,
        movement: "same",
      },
    ],
    svg: {
      fileName: `${queryAlias.toLowerCase()}-movement.local.svg`,
      sha256: hash(svg),
    },
  };
  const manifestText = json(manifest);
  return {
    manifest,
    manifestText,
    manifestSource: source(
      `${queryAlias.toLowerCase()}.local.ranking-movement.json`,
      manifestText,
    ),
    svg,
    svgSource: source(manifest.svg.fileName, svg),
  };
}

const rankings = [
  rankingFixture("Q1", "7"),
  rankingFixture("Q2", "8"),
  rankingFixture("Q3", "9"),
];

const buildArgs = {
  handoff,
  handoffText,
  handoffSource,
  metricManifest,
  metricManifestText,
  metricManifestSource,
  metricSvg,
  metricSvgSource: source(metricManifest.svg.fileName, metricSvg),
  rankings,
  createdAt,
  htmlFileName: "fictional.local.final-evidence.html",
};

function withSvg(
  ranking: (typeof rankings)[number],
  svg: string,
): (typeof rankings)[number] {
  const manifest = {
    ...ranking.manifest,
    svg: {
      ...ranking.manifest.svg,
      sha256: hash(svg),
    },
  };
  const manifestText = json(manifest);
  return {
    manifest,
    manifestText,
    manifestSource: source(
      ranking.manifestSource.fileName,
      manifestText,
    ),
    svg,
    svgSource: source(ranking.svgSource.fileName, svg),
  };
}

async function main() {
  const evidence = buildFinalEvidencePage(buildArgs);
  assert.equal(evidence.manifest.schemaVersion, "final-evidence-page-v1");
  assert.equal(evidence.manifest.sources.rankings.length, 3);
  assert.equal(evidence.manifest.page.sha256, hash(evidence.html));
  assert.match(evidence.html, /Final matcher evidence/);
  assert.match(evidence.html, /Precision@5/);
  assert.match(evidence.html, /Q1 ranking movement/);
  assert.match(evidence.html, /Q2 ranking movement/);
  assert.match(evidence.html, /Q3 ranking movement/);
  assert.match(evidence.html, /Curated feedback/);
  assert.match(evidence.html, new RegExp(matchingConfigHash));
  assert.match(evidence.html, new RegExp(implementationCommitSha));
  assert.equal((evidence.html.match(/<svg\b/g) ?? []).length, 4);
  assert.match(evidence.html, /id="metrics-title"/);
  assert.match(evidence.html, /id="ranking-1-title"/);
  assert.doesNotMatch(evidence.html, /id="title"/);
  assert.doesNotMatch(evidence.html, /\b(?:rec|tbl|app)[A-Za-z0-9]{10,}\b/);

  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "final-evidence-page-"),
  );
  try {
    const outputs = await writeFinalEvidencePage({
      evidence,
      htmlPath: "exports/fictional.local.final-evidence.html",
      manifestPath: "exports/fictional.local.final-evidence.json",
      workingDirectory: temporaryDirectory,
    });
    assert.equal(await readFile(outputs.htmlPath, "utf8"), evidence.html);
    assert.deepEqual(
      JSON.parse(await readFile(outputs.manifestPath, "utf8")),
      evidence.manifest,
    );
    await assert.rejects(
      writeFinalEvidencePage({
        evidence,
        htmlPath: "exports/fictional.local.final-evidence.html",
        manifestPath: "exports/fictional.local.final-evidence.json",
        workingDirectory: temporaryDirectory,
      }),
      /already exists/,
    );
    await assert.rejects(
      writeFinalEvidencePage({
        evidence,
        htmlPath: "../escaped.local.final-evidence.html",
        manifestPath: "exports/escaped.local.final-evidence.json",
        workingDirectory: temporaryDirectory,
      }),
      /must stay inside exports/,
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }

  assert.throws(
    () =>
      buildFinalEvidencePage({
        ...buildArgs,
        rankings: rankings.slice(0, 2),
      }),
    /requires three ranking charts/,
  );
  assert.throws(
    () =>
      buildFinalEvidencePage({
        ...buildArgs,
        rankings: [rankings[0], rankings[0], rankings[2]],
      }),
    /Q1, Q2 and Q3/,
  );
  assert.throws(
    () =>
      buildFinalEvidencePage({
        ...buildArgs,
        metricSvg: `${metricSvg}\n`,
      }),
    /manifest hash/,
  );
  const unsafeRanking = withSvg(
    rankings[0],
    rankings[0].svg.replace("</svg>", "<script>bad()</script></svg>"),
  );
  assert.throws(
    () =>
      buildFinalEvidencePage({
        ...buildArgs,
        rankings: [unsafeRanking, rankings[1], rankings[2]],
      }),
    /active SVG content/,
  );
  assert.throws(
    () =>
      buildFinalEvidencePage({
        ...buildArgs,
        rankings: [
          {
            ...rankings[0],
            manifestText: `${rankings[0].manifestText} `,
          },
          rankings[1],
          rankings[2],
        ],
      }),
    /text does not match its source hash/,
  );

  console.log("Final evidence page check passed.");
  console.log(
    "Checked four embedded charts, handoff identity, source hashes, privacy and protected output.",
  );
}

main().catch(error => {
  console.error(
    `Final evidence page check failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
});
