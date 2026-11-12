import type { FinalMatcherRouteResult } from "./final-matcher-route-result";
import {
  executeFinalMatcherRoute,
  type FinalMatcherRouteExecutionDependencies,
  type FinalMatcherRouteExecutionInput,
} from "./final-matcher-route-execution";

export type FinalMatcherRouteEffect = "save" | "notify";
export type FinalMatcherRouteEffectStatus = "complete" | "failed";

export interface FinalMatcherRouteLifecycleResult {
  result: FinalMatcherRouteResult;
  effects: {
    save: FinalMatcherRouteEffectStatus;
    notify: FinalMatcherRouteEffectStatus;
  };
}

export interface FinalMatcherRouteLifecycleDependencies
  extends FinalMatcherRouteExecutionDependencies {
  saveResult: (result: FinalMatcherRouteResult) => Promise<void>;
  notifyMatch: (result: FinalMatcherRouteResult) => Promise<void>;
  onEffectError?: (
    effect: FinalMatcherRouteEffect,
    error: unknown,
  ) => void;
}

async function runNonFatalEffect(args: {
  effect: FinalMatcherRouteEffect;
  run: () => Promise<void>;
  onError?: FinalMatcherRouteLifecycleDependencies["onEffectError"];
}): Promise<FinalMatcherRouteEffectStatus> {
  try {
    await args.run();
    return "complete";
  } catch (error) {
    try {
      args.onError?.(args.effect, error);
    } catch {
      // Error reporting must not turn a non-fatal route effect into a failure.
    }
    return "failed";
  }
}

export async function completeFinalMatcherRouteLifecycle(
  args: Omit<FinalMatcherRouteExecutionInput, "emitCompletion">,
  dependencies: FinalMatcherRouteLifecycleDependencies,
): Promise<FinalMatcherRouteLifecycleResult> {
  const result = await executeFinalMatcherRoute(
    { ...args, emitCompletion: false },
    { semanticScorer: dependencies.semanticScorer },
  );
  const save = await runNonFatalEffect({
    effect: "save",
    run: () => dependencies.saveResult(result),
    onError: dependencies.onEffectError,
  });

  args.onProgress?.({
    phase: "complete",
    current: 1,
    total: 1,
    message: "Matching complete!",
  });

  const notify = await runNonFatalEffect({
    effect: "notify",
    run: () => dependencies.notifyMatch(result),
    onError: dependencies.onEffectError,
  });
  return {
    result,
    effects: { save, notify },
  };
}
