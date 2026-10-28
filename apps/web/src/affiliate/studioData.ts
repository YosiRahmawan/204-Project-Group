import { useCallback, useEffect, useState } from 'react';
import { refreshers, request } from '../tasks/store';

export type Asset = {
  id: string;
  kind: string;
  name: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  seconds: number | null;
  sourceAssetId: string | null;
};
export type Job = {
  id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  progress: number;
  outputAssetId: string | null;
  error: string | null;
  createdAt: number;
};
export type MediaStatus = {
  configured: boolean;
  dir: string | null;
  onSystemDrive: boolean;
  ffmpeg: { available: boolean; version: string };
  limits: { maxVideoSeconds: number };
  cost: string;
};

export const fileUrl = (id: string) => `/api/media/${id}/file`;

// Media status, and the assets and export jobs of one campaign. Everything is read first and
// state is set afterwards, so the server's change stream can refresh it at any time.
export function useStudioData(campaignId: string | null) {
  const [status, setStatus] = useState<MediaStatus | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);

  const reload = useCallback(
    () =>
      (async () => {
        const s = await request<MediaStatus>('GET', '/media/status');
        if (!s.ok) return null;
        if (!s.data.configured || !campaignId)
          return { status: s.data, assets: null, jobs: null };
        const [a, j] = await Promise.all([
          request<{ assets: Asset[] }>(
            'GET',
            `/campaigns/${campaignId}/assets`,
          ),
          request<{ jobs: Job[] }>(
            'GET',
            `/campaigns/${campaignId}/render-jobs`,
          ),
        ]);
        return {
          status: s.data,
          assets: a.ok ? a.data.assets : null,
          jobs: j.ok ? j.data.jobs : null,
        };
      })().then((data) => {
        if (!data) return;
        setStatus(data.status);
        if (data.assets) setAssets(data.assets);
        if (data.jobs) setJobs(data.jobs);
      }),
    [campaignId],
  );

  useEffect(() => {
    const refresh = () => void reload();
    refresh();
    refreshers.add(refresh);
    return () => void refreshers.delete(refresh);
  }, [reload]);

  const active = jobs.some(
    (j) => j.status === 'queued' || j.status === 'running',
  );
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => void reload(), 2000);
    return () => window.clearInterval(timer);
  }, [active, reload]);

  return { status, assets, jobs, active, reload };
}
