// The only place the backend talks to Hermes: its OpenAI-compatible API server on this
// machine. The key comes from the server environment and is never returned, stored or logged.
export class HermesError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

export type HermesHealth = {
  configured: boolean;
  connected: boolean;
  model: string | null;
  // Toolsets the running profile exposes; Akira's phase 1 must have none that can act.
  toolsEnabled: string[];
  safe: boolean;
  checkedAt: number;
  reason: string;
};

// Toolsets that only read or think. Anything else being enabled makes the connection unsafe.
const HARMLESS_TOOLSETS = ['search', 'web', 'vision', 'todo'];

type Options = {
  url: string | undefined;
  key: string | undefined;
  fetchImpl?: typeof fetch | undefined;
  timeoutMs?: number;
  healthTimeoutMs?: number;
};

export function createHermes(options: Options) {
  const call = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 120_000;
  const healthTimeoutMs = options.healthTimeoutMs ?? 8_000;
  const configured = Boolean(options.url && options.key);
  const base = options.url?.replace(/\/+$/, '') ?? '';
  const headers = (extra: Record<string, string> = {}) => ({
    authorization: `Bearer ${options.key}`,
    ...extra,
  });

  let health: HermesHealth = {
    configured,
    connected: false,
    model: null,
    toolsEnabled: [],
    safe: false,
    checkedAt: 0,
    reason: configured
      ? 'Belum diperiksa.'
      : 'HERMES_API_URL dan HERMES_API_KEY belum diatur di server.',
  };

  const get = async (path: string) => {
    const response = await call(`${base}${path}`, {
      headers: headers(),
      signal: AbortSignal.timeout(healthTimeoutMs),
    });
    if (response.status === 401)
      throw new HermesError('Hermes menolak kunci API (401).', 502);
    if (!response.ok)
      throw new HermesError(`Hermes menjawab ${response.status}.`, 502);
    return (await response.json()) as Record<string, unknown>;
  };

  const self = {
    configured,
    get health() {
      return health;
    },
    // A live check: reachable, which model name it advertises, and which toolsets are switched on.
    async check(): Promise<HermesHealth> {
      if (!configured) return health;
      const next: HermesHealth = { ...health, checkedAt: Date.now() };
      try {
        const models = (await get('/v1/models')) as { data?: { id: string }[] };
        next.model = models.data?.[0]?.id ?? null;
        const toolsets = (await get('/v1/toolsets')) as {
          data?: { name: string; enabled: boolean }[];
        };
        next.toolsEnabled = (toolsets.data ?? [])
          .filter((t) => t.enabled)
          .map((t) => t.name);
        const risky = next.toolsEnabled.filter(
          (t) => !HARMLESS_TOOLSETS.includes(t),
        );
        next.connected = true;
        next.safe = risky.length === 0;
        next.reason = next.safe
          ? 'Terhubung.'
          : `Hermes memiliki tool yang bisa bertindak: ${risky.join(', ')}. Akira ditolak sampai dimatikan.`;
      } catch (error) {
        next.connected = false;
        next.safe = false;
        next.toolsEnabled = [];
        next.reason =
          error instanceof HermesError
            ? error.message
            : 'Hermes tidak terjangkau.';
      }
      health = next;
      return next;
    },

    // One non-streaming chat turn. A dropped connection or a 502-504 is retried once (nothing
    // is changed by a turn without tools); a busy Hermes (429) or a refused key is not retried.
    async chat(input: { system: string; user: string; maxTokens: number }) {
      if (!configured)
        throw new HermesError('Hermes belum dikonfigurasi di server.', 409);
      const body = JSON.stringify({
        model: health.model ?? 'akira',
        stream: false,
        max_tokens: input.maxTokens,
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
      });
      let lastError: HermesError = new HermesError('Hermes tidak terjangkau.');
      for (let attempt = 1; attempt <= 2; attempt++) {
        const started = Date.now();
        try {
          const response = await call(`${base}/v1/chat/completions`, {
            method: 'POST',
            headers: headers({ 'content-type': 'application/json' }),
            body,
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (response.status === 429)
            throw new HermesError('Hermes sedang memproses tugas lain.', 429);
          if (response.status === 401)
            throw new HermesError('Hermes menolak kunci API (401).', 502);
          if (response.status >= 502 && response.status <= 504 && attempt < 2) {
            lastError = new HermesError(`Hermes menjawab ${response.status}.`);
            continue;
          }
          if (!response.ok)
            throw new HermesError(`Hermes menjawab ${response.status}.`);
          const data = (await response.json()) as {
            model?: string;
            choices?: { message?: { content?: string } }[];
            usage?: {
              prompt_tokens?: number;
              completion_tokens?: number;
              total_tokens?: number;
            };
          };
          const text = data.choices?.[0]?.message?.content?.trim();
          if (!text)
            throw new HermesError('Hermes tidak mengembalikan jawaban.');
          const u = data.usage;
          return {
            text,
            model: data.model ?? health.model ?? 'akira',
            usage:
              u && typeof u.total_tokens === 'number'
                ? {
                    prompt: u.prompt_tokens ?? 0,
                    completion: u.completion_tokens ?? 0,
                    total: u.total_tokens,
                  }
                : null,
            ms: Date.now() - started,
          };
        } catch (error) {
          if (error instanceof HermesError) {
            if (error.status === 429 || error.message.includes('401'))
              throw error;
            lastError = error;
          } else if (error instanceof Error && error.name === 'TimeoutError') {
            throw new HermesError(
              'Hermes tidak menjawab dalam batas waktu.',
              504,
            );
          } else lastError = new HermesError('Hermes tidak terjangkau.');
        }
      }
      throw lastError;
    },
  };
  return self;
}
export type Hermes = ReturnType<typeof createHermes>;
