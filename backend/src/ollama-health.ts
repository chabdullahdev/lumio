/**
 * Is the local AI ready? Used by the lesson worker and the librarian so they
 * wait quietly while Ollama is stopped, instead of claiming jobs they cannot
 * finish (which would burn retry attempts).
 *
 * `evaluateTags` is pure and unit tested; `checkOllama` does the network call.
 */

export type OllamaHealth =
  | { ok: true; installed: string[] }
  | { ok: false; reason: string; installed: string[] };

/** Decide readiness from the body of Ollama's `/api/tags` response. */
export function evaluateTags(data: unknown, model: string): OllamaHealth {
  const models =
    typeof data === 'object' && data !== null && Array.isArray((data as { models?: unknown }).models)
      ? ((data as { models: Array<{ name?: unknown }> }).models)
      : [];
  const installed = models.map(entry => String(entry.name ?? '')).filter(name => name.length > 0);
  if (installed.includes(model)) {
    return { ok: true, installed };
  }
  const list = installed.length > 0 ? installed.join(', ') : 'none';
  return {
    ok: false,
    reason: `model "${model}" is not installed (installed: ${list}). Run: ollama pull ${model}`,
    installed,
  };
}

/** Ask the running Ollama server which models it has. Never throws. */
export async function checkOllama(baseUrl: string, model: string, timeoutMs = 5000): Promise<OllamaHealth> {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/tags`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      return { ok: false, reason: `Ollama answered HTTP ${response.status}`, installed: [] };
    }
    return evaluateTags(await response.json(), model);
  } catch {
    return { ok: false, reason: `Ollama is not running at ${baseUrl}. Start the Ollama app.`, installed: [] };
  }
}
