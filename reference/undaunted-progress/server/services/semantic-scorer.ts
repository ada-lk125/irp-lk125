import OpenAI from 'openai';

export interface SemanticScoreResult {
  score: number;
  exclusion_found: boolean;
  insight: string;
}

export interface SemanticScoringConfig {
  aiModel: string;
  aiMaxTokens: number;
  aiSystemPrompt: string;
  defaultScores: {
    aiFailure: number;
  };
}

export interface SemanticCompletionRequest {
  model: string;
  maxTokens: number;
  systemPrompt: string;
  userPrompt: string;
}

export type SemanticCompletion = (
  request: SemanticCompletionRequest,
) => Promise<string | null | undefined>;

export type SemanticScorer = (
  startupContext: string,
  investorContext: string,
  feedbackContext: string,
  config: SemanticScoringConfig,
) => Promise<SemanticScoreResult>;

export interface GptSemanticScorerDependencies {
  complete?: SemanticCompletion;
  wait?: (delayMs: number) => Promise<void>;
  reportError?: (attempt: number, error: unknown) => void;
}

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return openaiClient;
}

async function completeWithOpenAI(
  request: SemanticCompletionRequest,
): Promise<string | null | undefined> {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: request.model,
    response_format: { type: 'json_object' },
    max_completion_tokens: request.maxTokens,
    messages: [
      { role: 'system', content: request.systemPrompt },
      { role: 'user', content: request.userPrompt },
    ],
  });

  return response.choices?.[0]?.message?.content;
}

export function createGptSemanticScorer(
  dependencies: GptSemanticScorerDependencies = {},
): SemanticScorer {
  const complete = dependencies.complete ?? completeWithOpenAI;
  const wait = dependencies.wait
    ?? (delayMs => new Promise(resolve => setTimeout(resolve, delayMs)));
  const reportError = dependencies.reportError
    ?? ((attempt, error) => console.error(`AI scoring attempt ${attempt} failed:`, error));

  return async (
    startupContext,
    investorContext,
    feedbackContext,
    config,
  ) => {
    if (!startupContext.trim() || !investorContext.trim()) {
      return {
        score: config.defaultScores.aiFailure,
        exclusion_found: false,
        insight: 'Insufficient data for semantic analysis',
      };
    }

    const request: SemanticCompletionRequest = {
      model: config.aiModel,
      maxTokens: config.aiMaxTokens,
      systemPrompt: `${config.aiSystemPrompt}${feedbackContext}`,
      userPrompt: `STARTUP:\n${startupContext}\n\nINVESTOR:\n${investorContext}`,
    };
    const delays = [0, 1000, 2000];

    for (let attempt = 0; attempt < delays.length; attempt++) {
      try {
        if (delays[attempt] > 0) {
          await wait(delays[attempt]);
        }

        const content = await complete(request);
        if (!content) {
          continue;
        }

        const parsed = JSON.parse(content);
        return {
          score: typeof parsed.score === 'number'
            ? Math.max(0, Math.min(100, parsed.score))
            : config.defaultScores.aiFailure,
          exclusion_found: parsed.exclusion_found === true,
          insight: typeof parsed.insight === 'string'
            ? parsed.insight
            : 'No insight provided',
        };
      } catch (error) {
        reportError(attempt + 1, error);
      }
    }

    return {
      score: config.defaultScores.aiFailure,
      exclusion_found: false,
      insight: 'Unable to perform semantic analysis',
    };
  };
}

export const scoreSemanticMatch = createGptSemanticScorer();
