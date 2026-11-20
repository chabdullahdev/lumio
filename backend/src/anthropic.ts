/**
 * Hosted AI for lesson generation (Anthropic Messages API).
 *
 * Used instead of a local Ollama server when `ANTHROPIC_API_KEY` is set (or
 * `AI_PROVIDER=anthropic`). It is a drop-in for `chatJson`: same inputs, same
 * raw-text output, and everything it returns is still validated afterwards in
 * `lessons/validate.ts`. The API key is read from the environment, lives only
 * in `backend/.env`, and is never sent anywhere except api.anthropic.com.
 *
 * Two model tiers keep the cost low: the lesson writer uses ANTHROPIC_MODEL,
 * while the small "which topic next?" and "which books?" choices use
 * ANTHROPIC_LIGHT_MODEL.
 */
import type { OllamaMessage, OllamaOptions } from './ollama.ts';

export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5-5';
export const DEFAULT_ANTHROPIC_LIGHT_MODEL = 'claude-haiku-5-5';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

type Env = Record<string, string | undefined>;

/** Which AI the backend uses: explicit AI_PROVIDER wins, else a key means hosted, else Ollama. */
export function aiProvider(env: Env = process.env): 'anthropic' | 'ollama' {
  const explicit = env.AI_PROVIDER?.trim().toLowerCase();
  if (explicit === 'anthropic' || explicit === 'ollama') {
    return explicit;
  }
  return env.ANTHROPIC_API_KEY?.trim() ? 'anthropic' : 'ollama';
}

export function anthropicModelFor(tier: OllamaOptions['tier'], env: Env = process.env): string {
  return tier === 'light'
    ? env.ANTHROPIC_LIGHT_MODEL?.trim() || DEFAULT_ANTHROPIC_LIGHT_MODEL
    : env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
}

/** Ready/not-ready for the worker's "is the AI available?" check. Never calls the network. */
export function anthropicReadiness(env: Env = process.env): { ok: true } | { ok: false; reason: string } {
  return env.ANTHROPIC_API_KEY?.trim()
    ? { ok: true }
    : { ok: false, reason: 'ANTHROPIC_API_KEY is not set in backend/.env.' };
}

/** The request body. Pure, so it can be unit tested. */
export function buildAnthropicBody(
  options: OllamaOptions,
  messages: OllamaMessage[],
  env: Env = process.env,
): Record<string, unknown> {
  const system = messages
    .filter(message => message.role === 'system')
    .map(message => message.content)
    .join('\n\n');
  return {
    model: anthropicModelFor(options.tier, env),
    max_tokens: options.numPredict ?? 4096,
    ...(system ? { system } : {}),
    messages: messages
      .filter(message => message.role === 'user')
      .map(message => ({ role: 'user', content: message.content })),
  };
}

/** Pull the text out of a Messages API response; throws a readable error if there is none. */
export function textFromAnthropic(payload: unknown): string {
  const body = payload as { content?: { type?: string; text?: string }[]; stop_reason?: string } | null;
  const text = (body?.content ?? [])
    .filter(part => part.type === 'text' && typeof part.text === 'string')
    .map(part => part.text)
    .join('');
  if (text.trim().length === 0) {
    throw new Error(`The AI returned an empty response (stop reason: ${body?.stop_reason ?? 'unknown'}).`);
  }
  return text;
}

export async function chatAnthropic(
  options: OllamaOptions,
  messages: OllamaMessage[],
  env: Env = process.env,
): Promise<string> {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Add it to backend/.env.');
  }
  const body = buildAnthropicBody(options, messages, env);
  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': API_VERSION },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new Error(`The AI did not respond within ${Math.round(options.timeoutMs / 1000)}s.`);
    }
    throw new Error(`Could not reach the AI service: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    // Never echo the key; the API's own error text is safe to show.
    throw new Error(`The AI service returned HTTP ${response.status} for model "${String(body.model)}": ${detail.slice(0, 300)}`);
  }
  return textFromAnthropic(await response.json());
}
