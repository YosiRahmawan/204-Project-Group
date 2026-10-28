export class AiError extends Error {}

// One call to the Anthropic Messages API. The key comes from the server environment and is
// only sent to Anthropic; it is never returned, stored or logged.
export async function askClaude(options: {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  maxTokens: number;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const call = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await call('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': options.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options.model,
        max_tokens: options.maxTokens,
        system: options.system,
        messages: [{ role: 'user', content: options.prompt }],
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new AiError('Provider AI tidak terjangkau.');
  }
  if (!response.ok)
    throw new AiError(`Provider AI menolak permintaan (${response.status}).`);
  const body = (await response.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = body.content?.find((block) => block.type === 'text')?.text;
  if (!text) throw new AiError('Provider AI tidak mengembalikan teks.');
  return text;
}

// The model is asked for JSON only, but may still wrap it in prose or a code fence.
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start)
    throw new AiError('Jawaban AI tidak bisa dibaca.');
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new AiError('Jawaban AI tidak bisa dibaca.');
  }
}
