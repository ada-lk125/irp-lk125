const form = document.querySelector("#matching-form");
const runButton = document.querySelector("#run-button");
const formStatus = document.querySelector("#form-status");
const resultsSection = document.querySelector("#results");

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function scoreBar(score) {
  const track = element("div", "score-track");
  const fill = element("span", "score-fill");
  fill.style.width = `${Math.max(0, Math.min(100, score))}%`;
  track.append(fill);
  return track;
}

function renderMatch(container, match, movements) {
  const movement = movements.get(match.investorId);
  const card = element("article", "match-card");
  const top = element("div", "match-topline");
  const rank = element("span", "rank", String(match.rank).padStart(2, "0"));
  const identity = element("div", "match-identity");
  identity.append(
    element("h4", "", match.organisation),
    element(
      "p",
      "",
      movement === 0
        ? "Rank unchanged"
        : movement > 0
          ? `Moved up ${movement}`
          : `Moved down ${Math.abs(movement)}`,
    ),
  );
  const score = element("strong", "total-score", String(match.totalScore));
  top.append(rank, identity, score);

  const scoreGrid = element("dl", "score-grid");
  const dimensions = [
    ["Stage", match.scoreBreakdown.stageMatch],
    ["Ticket", match.scoreBreakdown.ticketSizeMatch],
    ["Sector", match.scoreBreakdown.sectorOverlap],
    ["Geography", match.scoreBreakdown.geographyMatch],
    ["Instrument", match.scoreBreakdown.instrumentMatch],
    ["Text", match.scoreBreakdown.semanticScore],
  ];
  for (const [label, value] of dimensions) {
    const item = element("div", "score-item");
    item.append(
      element("dt", "", label),
      element("dd", "", String(value)),
      scoreBar(value),
    );
    scoreGrid.append(item);
  }

  const reason = element(
    "p",
    "match-reason",
    match.matchReasons[0] || "No positive rule reason recorded.",
  );
  card.append(top, scoreGrid, reason);
  container.append(card);
}

function formPayload() {
  const data = new FormData(form);
  const optionalText = name => {
    const value = data.get(name);
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  };
  return {
    startupName: data.get("startupName"),
    description: data.get("description"),
    climateProblem: optionalText("climateProblem"),
    solutionDescription: optionalText("solutionDescription"),
    businessModel: optionalText("businessModel"),
    targetMarket: optionalText("targetMarket"),
    competitors: optionalText("competitors"),
    roundStage: data.get("roundStage"),
    amountRaising: Number(data.get("amountRaising")) || undefined,
    minTicketSize: Number(data.get("minTicketSize")) || undefined,
    investmentTypes: [data.get("investmentType")],
    roundGeography: data.get("roundGeography"),
    roundSectors: [data.get("sector")],
    tweetPitch: optionalText("tweetPitch"),
    tractionSummary: optionalText("tractionSummary"),
    unfairAdvantage: optionalText("unfairAdvantage"),
    preferredInvestorTypes: data.getAll("preferredInvestorTypes"),
  };
}

function formatMetric(value) {
  return Number(value).toFixed(4);
}

function renderEvidence(summary) {
  document.querySelector("#evidence-date").textContent =
    `As of ${new Date(`${summary.asOf}T00:00:00Z`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })}`;
  document.querySelector("#baseline-label-count").textContent =
    String(summary.baseline.labelCount);
  document.querySelector("#baseline-query-count").textContent =
    String(summary.baseline.queryCount);
  document.querySelector("#baseline-ndcg").textContent =
    formatMetric(summary.baseline.macro.ndcgAt10);
  document.querySelector("#baseline-precision").textContent =
    formatMetric(summary.baseline.macro.precisionAt10);
  document.querySelector("#completed-case-count").textContent =
    String(summary.finalEvaluation.completedCaseCount);
  document.querySelector("#case-count-range").textContent =
    `${summary.finalEvaluation.minimumCaseCount}–${summary.finalEvaluation.maximumCaseCount}`;
  document.querySelector("#completed-reviewer-count").textContent =
    String(summary.finalEvaluation.completedReviewerCount);
  document.querySelector("#target-reviewer-count").textContent =
    String(summary.finalEvaluation.targetReviewerCount);
  const pilotEvaluated =
    summary.evidenceStatus === "model-assisted-pilot-evaluated";
  const modelAssistedFinal =
    summary.evidenceStatus === "model-assisted-authoritative-snapshot-evaluated";
  const finalEvidenceReady =
    modelAssistedFinal ||
    summary.evidenceStatus === "expert-case-study-evaluated";
  const caseStudyEvaluated = pilotEvaluated || finalEvidenceReady;
  document.querySelector("#final-gate-card").classList.toggle(
    "pending",
    !caseStudyEvaluated,
  );
  document.querySelector("#final-gate-label").textContent = modelAssistedFinal
    ? "Final model-assisted study"
    : finalEvidenceReady
      ? "Final study cases"
      : pilotEvaluated
        ? "Model-assisted pilot cases"
        : "Final study cases pending";
  document.querySelector("#claim-status").classList.toggle(
    "complete",
    finalEvidenceReady,
  );
  document.querySelector("#reviewer-note").textContent =
    pilotEvaluated || modelAssistedFinal
      ? "Claude Opus 5 model-assisted review; human spot-check pending"
      : "Maiko plus Cathal if available";
  const metrics = summary.finalEvaluation.metrics;
  document.querySelector("#pilot-p5-legacy").textContent =
    formatMetric(metrics.legacy.precisionAt5);
  document.querySelector("#pilot-p5-optimised").textContent =
    formatMetric(metrics.normalisationV1.precisionAt5);
  document.querySelector("#pilot-p5-delta").textContent =
    `+${formatMetric(metrics.delta.precisionAt5)}`;
  document.querySelector("#pilot-p10-legacy").textContent =
    formatMetric(metrics.legacy.precisionAt10);
  document.querySelector("#pilot-p10-optimised").textContent =
    formatMetric(metrics.normalisationV1.precisionAt10);
  document.querySelector("#pilot-p10-delta").textContent =
    `+${formatMetric(metrics.delta.precisionAt10)}`;
  document.querySelector("#candidate-count").textContent =
    String(summary.comparisonPilot.candidateCount);
  document.querySelector("#evidence-claim").textContent = summary.claim;

  const overlaps = document.querySelector("#pilot-overlaps");
  overlaps.replaceChildren();
  for (const method of summary.comparisonPilot.semanticModes) {
    const item = element("div", "overlap-row");
    item.append(
      element("strong", "", method.label),
      element(
        "span",
        "",
        method.top10OverlapByQuery
          .map((value, index) => `Q${index + 1} ${value}/10`)
          .join(" · "),
      ),
    );
    overlaps.append(item);
  }
}

function updateNormalisationSummary(payload, normalised) {
  document.querySelector("#stage-change").textContent =
    `${payload.roundStage} → ${normalised.roundStage}`;
  document.querySelector("#geography-change").textContent =
    `${payload.roundGeography} → ${normalised.roundGeography}`;
  document.querySelector("#instrument-change").textContent =
    `${payload.investmentTypes.join(", ")} → ${normalised.investmentTypes.join(", ")}`;
}

function renderComparison(payload, comparison, scrollToResults) {
  updateNormalisationSummary(payload, comparison.normalisedInput);
  const baselineContainer = document.querySelector("#baseline-results");
  const optimisedContainer = document.querySelector("#optimised-results");
  baselineContainer.replaceChildren();
  optimisedContainer.replaceChildren();

  const movementByInvestor = new Map(
    comparison.movements.map((item) => [item.investorId, item.movement]),
  );
  const reverseMovement = new Map(
    comparison.movements.map((item) => [item.investorId, -item.movement]),
  );
  for (const match of comparison.baseline.matches) {
    renderMatch(baselineContainer, match, reverseMovement);
  }
  for (const match of comparison.optimised.matches) {
    renderMatch(optimisedContainer, match, movementByInvestor);
  }

  const changed = comparison.movements.filter((item) => item.movement !== 0).length;
  document.querySelector("#result-summary").textContent =
    `${comparison.dataset.investorCount} fictional investors · ${changed} changed rank`;
  document.querySelector("#evidence-boundary").textContent =
    comparison.evidenceBoundary;
  resultsSection.hidden = false;
  if (scrollToResults) {
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function runComparison({ scrollToResults = true } = {}) {
  const payload = formPayload();
  runButton.disabled = true;
  formStatus.textContent = "Running both profiles…";

  try {
    const response = await fetch("/api/compare", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Comparison failed.");
    renderComparison(payload, body, scrollToResults);
    formStatus.textContent = "Comparison complete.";
  } catch (error) {
    formStatus.textContent =
      error instanceof Error ? error.message : "Comparison failed.";
  } finally {
    runButton.disabled = false;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void runComparison();
});

fetch("/api/evidence")
  .then(async response => {
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Evidence unavailable.");
    renderEvidence(body);
  })
  .catch(() => {
    document.querySelector("#evidence-claim").textContent =
      "The aggregate evidence summary could not be loaded. The matching demonstration remains available.";
  });

if (new URLSearchParams(window.location.search).get("autorun") === "1") {
  void runComparison({ scrollToResults: false });
}
