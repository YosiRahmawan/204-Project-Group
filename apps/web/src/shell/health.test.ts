import { afterEach, expect, test, vi } from 'vitest';
import { checkHealth } from './health';

afterEach(() => vi.unstubAllGlobals());

test('only accepts a successful response from the expected health service', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ status: 'ok', service: '204-project-group' }),
      ),
    );
  vi.stubGlobal('fetch', fetchMock);
  await expect(
    checkHealth(new AbortController().signal),
  ).resolves.toBeUndefined();
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/health',
    expect.objectContaining({ cache: 'no-store' }),
  );
  fetchMock.mockResolvedValue(new Response('{}', { status: 503 }));
  await expect(checkHealth(new AbortController().signal)).rejects.toThrow();
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ status: 'ok', service: 'other' })),
  );
  await expect(checkHealth(new AbortController().signal)).rejects.toThrow();
  fetchMock.mockResolvedValue(new Response('not-json'));
  await expect(checkHealth(new AbortController().signal)).rejects.toThrow();
});
