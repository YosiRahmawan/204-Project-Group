export async function checkHealth(signal: AbortSignal): Promise<void> {
  const response = await fetch('/api/health', { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Backend health request failed');
  const body: unknown = await response.json();
  if (
    typeof body !== 'object' ||
    body === null ||
    !('status' in body) ||
    body.status !== 'ok' ||
    !('service' in body) ||
    body.service !== '204-project-group'
  ) {
    throw new Error('Unexpected backend health response');
  }
}
