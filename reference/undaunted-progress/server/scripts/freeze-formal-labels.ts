import { runFreezeLabelsCli } from "./freeze-labels-cli";

void runFreezeLabelsCli({
  purpose: "formal",
  label: "Formal",
  expectedRowsPerQuery: 10,
});
