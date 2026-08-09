const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

/**
 * Minimal DeepSeek client — the API is OpenAI-compatible, so a raw JSON
 * request with response_format json_object is all that's needed.
 */
export async function deepseekJson(apiKey: string, system: string, user: string): Promise<unknown> {
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
  });

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
