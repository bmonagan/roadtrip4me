const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
// LLM calls are slow; allow a generous timeout so a hung request can't leave
// a background recommendation job stuck forever.
const DEEPSEEK_TIMEOUT_MS = 60_000;

/**
 * Minimal DeepSeek client — the API is OpenAI-compatible, so a raw JSON
 * request with response_format json_object is all that's needed.
 */
export async function deepseekJson(apiKey: string, system: string, user: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEEPSEEK_TIMEOUT_MS);
  const res = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!res.ok) {
    throw new Error(`DeepSeek API error ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('DeepSeek returned no message content');
  }

  return JSON.parse(content);
}
