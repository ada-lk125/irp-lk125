import { describe, expect, it } from "vitest";
import type { FrozenLabellingSummary } from "./frozen-labelling";
import {
  buildFrozenLabelManifest,
  parseFrozenLabelManifest,
} from "./frozen-labelling-manifest";

const summary: FrozenLabellingSummary = {
  rowCount: 30,
  judgedRowCount: 30,
  holdRowCount: 0,
  completeQueryCount: 3,
  incompleteQueryCount: 0,
  incompleteQueryIds: [],
};

describe("frozen labelling manifest", () => {
  it("builds a manifest bound to the labelled CSV and source pack", () => {
    const csv = "\"queryId\"\n";
    const manifest = buildFrozenLabelManifest({
      csv,
      fileName: "blind-labelling-formal-v3-labelled.local.csv",
      frozenVersion: "formal-v3-frozen-v1",
      frozenAt: "2026-07-23T00:00:00.000Z",
      sourcePackVersion: "formal-v3",
      sourcePackSha256: "a".repeat(64),
      summary,
    });

    expect(manifest).toMatchObject({
      frozenVersion: "formal-v3-frozen-v1",
      sourcePackVersion: "formal-v3",
      sourcePackSha256: "a".repeat(64),
      rowCount: 30,
      queryCount: 3,
      judgedRowCount: 30,
      holdRowCount: 0,
      completeQueryCount: 3,
      incompleteQueryCount: 0,
      columnCount: 36,
    });
  });

  it("rejects a malformed source-pack hash", () => {
    const csv = "\"queryId\"\n";
    const manifest = buildFrozenLabelManifest({
      csv,
      fileName: "blind-labelling-formal-v3-labelled.local.csv",
      frozenVersion: "formal-v3-frozen-v1",
      frozenAt: "2026-07-23T00:00:00.000Z",
      sourcePackVersion: "formal-v3",
      sourcePackSha256: "a".repeat(64),
      summary,
    });
    expect(() =>
      parseFrozenLabelManifest(
        {
          ...manifest,
          sourcePackSha256: "not-a-hash",
        },
        {
          csv,
          fileName: "blind-labelling-formal-v3-labelled.local.csv",
        },
      ),
    ).toThrow(/sourcePackSha256 must be a SHA-256 hash/);
  });
});
