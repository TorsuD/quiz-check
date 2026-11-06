import "server-only";
import { z } from "zod";
import { complete, type ChatTurn, type Provider } from "./llm";
import { SYSTEM_PROMPT, buildRetryPrompt, buildUserPrompt } from "./prompts";
import { parseJsonLoose } from "./text";

export { excerptAppearsIn, stripCodeFences } from "./text";

export const GeneratedQuestionSchema = z.object({
  question: z.string().trim().min(1),
  options: z.array(z.string().trim().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(1),
  sourceExcerpt: z.string().trim().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

export const GenerationSchema = z.object({
  questions: z.array(GeneratedQuestionSchema).min(1),
});

export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

type ParseResult = { ok: true; questions: GeneratedQuestion[] } | { ok: false; problem: string };

export function parseGeneration(raw: string): ParseResult {
  let data: unknown;
  try {
    data = parseJsonLoose(raw).data;
  } catch {
    return { ok: false, problem: "the output was not valid JSON." };
  }
  const result = GenerationSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return { ok: false, problem: `the JSON did not match the required shape (${issues}).` };
  }
  return { ok: true, questions: result.data.questions };
}

export class GenerationError extends Error {}

export type GenerationOutput = {
  questions: GeneratedQuestion[];
  provider: Provider | "import";
  model: string;
  attempts: number;
};

/** Progress while the model writes: how many questions have been started, and which attempt this is. */
export type GenerationProgress = { started: number; attempt: number };

/** Counts the "question" keys streamed so far. Approximate, for the progress bar only. */
export function countStartedQuestions(soFar: string): number {
  return soFar.match(/"question"\s*:/g)?.length ?? 0;
}

/** Calls the LLM, validates the JSON with zod, and retries once on invalid output. */
export async function generateQuestions(
  title: string,
  text: string,
  count: number,
  onProgress: (p: GenerationProgress) => void = () => {},
): Promise<GenerationOutput> {
  const messages: ChatTurn[] = [{ role: "user", content: buildUserPrompt(title, text, count) }];
  const track = (attempt: number) => {
    let last = -1;
    return (soFar: string) => {
      const started = countStartedQuestions(soFar);
      if (started !== last) onProgress({ started: (last = started), attempt });
    };
  };

  const first = await complete(SYSTEM_PROMPT, messages, track(1));
  const firstParsed = parseGeneration(first.text);
  if (firstParsed.ok) {
    return { questions: firstParsed.questions, provider: first.provider, model: first.model, attempts: 1 };
  }

  const retryMessages: ChatTurn[] = [
    ...messages,
    { role: "assistant", content: first.text || "(empty response)" },
    { role: "user", content: buildRetryPrompt(firstParsed.problem) },
  ];
  onProgress({ started: 0, attempt: 2 });
  const second = await complete(SYSTEM_PROMPT, retryMessages, track(2));
  const secondParsed = parseGeneration(second.text);
  if (secondParsed.ok) {
    return { questions: secondParsed.questions, provider: second.provider, model: second.model, attempts: 2 };
  }
  throw new GenerationError(
    `The model returned invalid output twice. Last problem: ${secondParsed.problem} Please try again, or reduce the number of questions.`,
  );
}
