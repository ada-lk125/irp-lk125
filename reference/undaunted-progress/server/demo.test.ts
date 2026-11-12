import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDemoServer } from "./demo";

const sampleRequest = {
  startupName: "Sample Heat Planning",
  description:
    "Software for industrial heat pump planning and lower-carbon retrofits.",
  climateProblem: "Industrial heat remains dependent on fossil fuels.",
  solutionDescription: "Planning software for heat-pump retrofits.",
  businessModel: "B2B software subscription.",
  targetMarket: "UK and European industrial sites.",
  competitors: "Engineering consultancies.",
  roundStage: "pre_seed",
  amountRaising: 1_200_000,
  minTicketSize: 50_000,
  investmentTypes: ["Equity (VC)"],
  roundGeography: "UK",
  roundSectors: ["Clean Energy", "Built Environment"],
  tweetPitch: "Plan industrial heat-pump retrofits faster.",
  tractionSummary: "Pilot projects with industrial operators.",
  unfairAdvantage: "A specialised industrial heat dataset.",
  preferredInvestorTypes: ["VC", "Impact Fund"],
};

describe("standalone IRP demo", () => {
  const server = createDemoServer();
  let baseUrl = "";

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("serves the local interface and health endpoint", async () => {
    const [
      pageResponse,
      autorunResponse,
      scriptResponse,
      stylesResponse,
      healthResponse,
      evidenceResponse,
    ] = await Promise.all([
      fetch(baseUrl),
      fetch(`${baseUrl}/?autorun=1`),
      fetch(`${baseUrl}/app.js`),
      fetch(`${baseUrl}/styles.css`),
      fetch(`${baseUrl}/api/health`),
      fetch(`${baseUrl}/api/evidence`),
    ]);
    expect(pageResponse.status).toBe(200);
    const page = await pageResponse.text();
    expect(page).toContain("Undaunted · Investor Matching IRP");
    expect(page).toContain("What is known today");
    expect(page).toContain("Pitch and investor preferences");
    expect(autorunResponse.status).toBe(200);
    expect(await autorunResponse.text()).toContain(
      "Undaunted · Investor Matching IRP",
    );
    expect(scriptResponse.status).toBe(200);
    expect(await scriptResponse.text()).toContain('get("autorun") === "1"');
    expect(stylesResponse.status).toBe(200);
    expect(await stylesResponse.text()).toContain(".comparison-grid");
    expect(await healthResponse.json()).toMatchObject({
      status: "ok",
      dataPolicy: "fictional-fixtures-only",
    });
    expect(await evidenceResponse.json()).toMatchObject({
      schemaVersion: "irp-evidence-summary-v3",
      evidenceStatus: "model-assisted-authoritative-snapshot-evaluated",
      baseline: {
        queryCount: 3,
        labelCount: 30,
        macro: { ndcgAt10: 0.829564 },
      },
      finalEvaluation: {
        protocol: "paired-model-assisted-case-study",
        minimumCaseCount: 4,
        maximumCaseCount: 4,
        completedCaseCount: 4,
        topK: 10,
        targetReviewerCount: 1,
        completedReviewerCount: 1,
        evidenceLevel: "model-assisted-authoritative-snapshot",
        pooledLabelCount: 56,
        metrics: {
          legacy: { precisionAt5: 0.35, precisionAt10: 0.3 },
          normalisationV1: { precisionAt5: 0.5, precisionAt10: 0.4 },
          delta: { precisionAt5: 0.15, precisionAt10: 0.1 },
        },
      },
    });
  });

  it("compares the real legacy and normalisation code paths", async () => {
    const response = await fetch(`${baseUrl}/api/compare`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sampleRequest),
    });
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.dataset).toMatchObject({
      kind: "fictional",
      investorCount: 4,
    });
    expect(body.normalisedInput).toEqual({
      roundStage: "Pre-seed",
      roundGeography: "United Kingdom",
      investmentTypes: ["Equity"],
    });
    expect(body.input).toMatchObject({
      climateProblem: sampleRequest.climateProblem,
      solutionDescription: sampleRequest.solutionDescription,
      tractionSummary: sampleRequest.tractionSummary,
      preferredInvestorTypes: ["VC", "Impact Fund"],
    });
    expect(body.baseline.matches).toHaveLength(4);
    expect(body.optimised.matches).toHaveLength(4);
    expect(body.movements).toHaveLength(4);
    expect(body.evidenceBoundary).toContain("not evidence");

    const baselineById = new Map(
      body.baseline.matches.map((match: { investorId: string }) => [
        match.investorId,
        match,
      ]),
    );
    for (const match of body.optimised.matches) {
      expect(baselineById.has(match.investorId)).toBe(true);
    }
  });

  it("rejects incomplete input without exposing an internal stack", async () => {
    const response = await fetch(`${baseUrl}/api/compare`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ startupName: "" }),
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("startupName is required.");
    expect(JSON.stringify(body)).not.toContain("at ");
  });

  it("enforces the current platform tweet-pitch length boundary", async () => {
    const response = await fetch(`${baseUrl}/api/compare`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...sampleRequest, tweetPitch: "x".repeat(281) }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "tweetPitch must be at most 280 characters.",
    });
  });
});
