import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  SEMANTIC_COMPARISON_SCHEMA_VERSION,
  buildSemanticComparisonIdentity,
} from "../services/semantic-comparison";

const identifiers = {
  queryId: "query-01",
  startupId: "startup-01",
  fundingRoundId: "round-01",
};

const identity = buildSemanticComparisonIdentity({
  ...identifiers,
  investorIds: ["investor-c", "investor-a", "investor-b"],
});
const reorderedIdentity = buildSemanticComparisonIdentity({
  ...identifiers,
  investorIds: ["investor-b", "investor-c", "investor-a"],
});
const changedIdentity = buildSemanticComparisonIdentity({
  ...identifiers,
  investorIds: ["investor-a", "investor-b", "investor-d"],
});

assert.equal(identity.schemaVersion, SEMANTIC_COMPARISON_SCHEMA_VERSION);
assert.equal(identity.candidateCount, 3);
assert.match(identity.candidatePoolHash, /^[a-f0-9]{64}$/);
assert.equal(identity.candidatePoolHash, reorderedIdentity.candidatePoolHash);
assert.notEqual(identity.candidatePoolHash, changedIdentity.candidatePoolHash);
const mixedCaseIds = ["recZ", "reca", "recA"];
const mixedCaseIdentity = buildSemanticComparisonIdentity({
  ...identifiers,
  investorIds: mixedCaseIds,
});
assert.equal(
  mixedCaseIdentity.candidatePoolHash,
  createHash("sha256")
    .update(JSON.stringify([...mixedCaseIds].sort()), "utf8")
    .digest("hex"),
);
assert.deepEqual(identity.methods, [
  "rule-only",
  "gpt-semantic",
  "text-similarity",
]);
assert.equal(identity.feedbackMode, "none");
assert.equal(identity.topK, 10);
assert.equal(identity.useSameCandidatePool, true);

assert.throws(
  () => buildSemanticComparisonIdentity({ ...identifiers, investorIds: [] }),
  /at least one candidate/,
);
assert.throws(
  () =>
    buildSemanticComparisonIdentity({
      ...identifiers,
      investorIds: ["investor-a", "investor-a"],
    }),
  /duplicate candidates/,
);
assert.throws(
  () => buildSemanticComparisonIdentity({ ...identifiers, investorIds: [" "] }),
  /non-empty identifier/,
);

console.log("Semantic comparison identity check passed.");
console.log(
  "Checked query identity, method order, candidate pool hashing, and invalid inputs.",
);
