/**
 * Minimal Ollama client for lesson generation.
 *
 * The local Ollama server is the only AI dependency: it runs on the
 * developer's machine (loopback only) and is never reachable from the app.
 * This module performs a single non-streaming chat completion and returns the
 * raw text; parsing and validation happen in `lessons/validate.ts` so the
 * model output is never trusted as-is.
 *
 * Timing details that matter: with `stream: false`, Ollama sends response
 * headers only after the whole generation finishes, which routinely takes
 * longer than undici's default 300-second per-phase timeouts (that cost one
 * debugging session: a failure surfaced as "Headers Timeout Error" while the
 * model was still working). The dedicated dispatcher disables the phase
 * timeouts; the AbortSignal below is the single, configurable overall budget.
 */
import { Agent } from 'undici';

export type OllamaOptions = {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  temperature?: number;
  numCtx?: number;
  numPredict?: number;
};

export type OllamaMessage = { role: 'system' | 'user'; content: string };

export type OllamaChatResponse = {
  message?: { role?: string; content?: string; thinking?: string };
  error?: string;
};

/** No per-phase limits: generation time is governed by the AbortSignal only. */
const LONG_RUNNING_DISPATCHER = new Agent({ headersTimeout: 0, bodyTimeout: 0 });

/** The JSON body sent to /api/chat. Pure — unit tested. */
export function buildChatBody(
  options: OllamaOptions,
  messages: OllamaMessage[],
): Record<string, unknown> {
  return {
    model: options.model,
    stream: false,
    format: 'json',
    // Skip thinking traces: we want the structured JSON, not reasoning text.
    think: false,
    messages,
    options: {
      temperature: options.temperature ?? 0.25,
      top_p: 0.9,
      num_ctx: options.numCtx ?? 8192,
      num_predict: options.numPredict ?? 4096,
    },
  };
}

/**
 * Run one chat completion and return the assistant text. Throws a readable
 * error for HTTP failures, timeouts, and empty responses.
 */
export async function chatJson(
  options: OllamaOptions,
  messages: OllamaMessage[],
): Promise<string> {
  const url = `${options.baseUrl.replace(/\/+$/, '')}/api/chat`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildChatBody(options, messages)),
      signal: AbortSignal.timeout(options.timeoutMs),
      dispatcher: LONG_RUNNING_DISPATCHER,
    } as RequestInit & { dispatcher: unknown });
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new Error(
        `Ollama did not respond within ${Math.round(options.timeoutMs / 1000)}s (model "${options.model}").`,
      );
    }
    const cause = error instanceof Error ? (error as { cause?: Error }).cause : undefined;
    const causeMessage = cause instanceof Error ? ` (${cause.message})` : '';
    throw new Error(
      `Could not reach Ollama at ${options.baseUrl}: ${error instanceof Error ? error.message : String(error)}${causeMessage}`,
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Ollama returned HTTP ${response.status} for model "${options.model}": ${body.slice(0, 300)}`,
    );
  }

  const payload = (await response.json()) as OllamaChatResponse;
  if (payload.error) {
    throw new Error(`Ollama error for model "${options.model}": ${payload.error}`);
  }
  const content = payload.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error(`Ollama returned an empty response for model "${options.model}".`);
  }
  return content;
}
