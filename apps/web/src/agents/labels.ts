import type { ConfigStatus, RuntimeStatus } from '@204/contracts';

export const configLabel: Record<ConfigStatus, string> = {
  not_configured: 'Not Configured',
  configured: 'Configured',
  invalid: 'Invalid Configuration',
};
export const runtimeLabel: Record<RuntimeStatus, string> = {
  not_connected: 'Not Connected',
  ready: 'Ready',
  running: 'Running',
  paused: 'Paused',
  error: 'Error',
  disabled: 'Disabled',
};
