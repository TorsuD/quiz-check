import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { FinishReason, GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

/**
 * Single swappable LLM module. Pick the provider with env vars:
 *   LLM_PROVIDER = "anthropic" | "openai" | "gemini"
 *   LLM_API_KEY  = the provider's API key (server-side only, never sent to the browser)
 *   LLM_MODEL    = model id (defaults below)
 */

const PROVIDERS = ["anthropic", "openai", "gemini"] as const;
export type Provider = (typeof PROVIDERS)[number];

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type LLMResult = { text: string; provider: Provider; model: string };

/** Called with the full text received so far, each time more of the response streams in. */
export type OnText = (soFar: string) => void;

const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-opus-5-5",
  openai: "gpt-4o",
  gemini: "gemini-flash-latest",
};

// Models that accept Anthropic's server-side refusal fallback ("default" routing).
const ANTHROPIC_FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

export function getLLMConfig(): { provider: Provider; model: string; apiKey: string } {
  const raw = (process.env.LLM_PROVIDER ?? "anthropic").toLowerCase();
  if (!(PROVIDERS as readonly string[]).includes(raw)) {
    throw new Error(`LLM_PROVIDER must be one of ${PROVIDERS.join(", ")} (got "${raw}").`);
  }
  const provider = raw as Provider;
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error("LLM_API_KEY is not set.");
  const model = process.env.LLM_MODEL || DEFAULT_MODELS[provider];
  return { provider, model, apiKey };
}

/** All providers stream, so progress can be reported while the questions are being written. */
export async function complete(system: string, messages: ChatTurn[], onText: OnText = () => {}): Promise<LLMResult> {
  const { provider, model, apiKey } = getLLMConfig();
  switch (provider) {
    case "anthropic":
      return completeAnthropic(apiKey, model, system, messages, onText);
    case "openai":
      return completeOpenAI(apiKey, model, system, messages, onText);
    case "gemini":
      return completeGemini(apiKey, model, system, messages, onText);
  }
}

async function completeAnthropic(
  apiKey: string,
  model: string,
  system: string,
  messages: ChatTurn[],
  onText: OnText,
): Promise<LLMResult> {
  const client = new Anthropic({ apiKey });
  const useFallback = ANTHROPIC_FALLBACK_MODELS.has(model);
  // Streaming avoids HTTP timeouts on long lecture notes; finalMessage() collects the result.
  const stream = client.beta.messages.stream({
    model,
    max_tokens: 32000,
    system,
    messages,
    ...(useFallback
      ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
      : {}),
  });
  stream.on("text", (_delta, snapshot) => onText(snapshot));
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") {
    throw new Error("The model declined to generate questions for this content.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("The model's output was cut off (max_tokens). Try fewer questions.");
  }
  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return { text, provider: "anthropic", model: message.model ?? model };
}

async function completeOpenAI(
  apiKey: string,
  model: string,
  system: string,
  messages: ChatTurn[],
  onText: OnText,
): Promise<LLMResult> {
  const client = new OpenAI({ apiKey });
  const stream = await client.chat.completions.create({
    model,
    stream: true,
    response_format: { type: "json_object" },
    messages: [{ role: "system", content: system }, ...messages],
  });
  let text = "";
  let finish: string | null | undefined = null;
  let usedModel = model;
  for await (const chunk of stream) {
    usedModel = chunk.model || usedModel;
    const choice = chunk.choices[0];
    if (choice?.delta?.content) {
      text += choice.delta.content;
      onText(text);
    }
    if (choice?.finish_reason) finish = choice.finish_reason;
  }
  if (finish === "length") {
    throw new Error("The model's output was cut off. Try fewer questions.");
  }
  return { text, provider: "openai", model: usedModel };
}

async function completeGemini(
  apiKey: string,
  model: string,
  system: string,
  messages: ChatTurn[],
  onText: OnText,
): Promise<LLMResult> {
  const ai = new GoogleGenAI({ apiKey });
  const stream = await ai.models.generateContentStream({
    model,
    // Gemini calls the assistant role "model".
    contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
    },
  });
  let text = "";
  let finish: FinishReason | undefined;
  let blocked = false;
  let usedModel = model;
  for await (const chunk of stream) {
    if (chunk.text) {
      text += chunk.text;
      onText(text);
    }
    finish = chunk.candidates?.[0]?.finishReason ?? finish;
    if (chunk.promptFeedback?.blockReason) blocked = true;
    usedModel = chunk.modelVersion ?? usedModel;
  }
  if (finish === FinishReason.MAX_TOKENS) {
    throw new Error("The model's output was cut off. Try fewer questions.");
  }
  if (finish === FinishReason.SAFETY || blocked) {
    throw new Error("The model declined to generate questions for this content.");
  }
  return { text, provider: "gemini", model: usedModel };
}
