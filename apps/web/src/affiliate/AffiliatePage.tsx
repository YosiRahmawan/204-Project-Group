import { useState } from 'react';
import {
  GENERATE_KINDS,
  PLATFORMS,
  campaignInputSchema,
  emptyCampaign,
  platformLabel,
  type CampaignInput,
  type CampaignView,
  type GenerateKind,
} from '@204/contracts';
import { useAgents } from '../agents/store';
import { campaignActions, useCampaigns } from './store';

type Section =
  'product' | 'trend' | 'content' | 'video' | 'music' | 'library' | 'analytics';
// Only the first, third and sixth exist in phase 1; the rest are shown so the plan is visible.
const sections: { id: Section; label: string; ready: boolean }[] = [
  { id: 'product', label: 'Product & Affiliate Link', ready: true },
  { id: 'trend', label: 'AI Trend Analyzer', ready: false },
  { id: 'content', label: 'Content Generator', ready: true },
  { id: 'video', label: 'Video Studio', ready: false },
  { id: 'music', label: 'Music & Voice', ready: false },
  { id: 'library', label: 'Content Library', ready: true },
  { id: 'analytics', label: 'Analytics', ready: false },
];
const kindLabel: Record<GenerateKind, string> = {
  script: 'Script & hook (Aeri)',
  caption: 'Caption & hashtag (Aeri)',
  storyboard: 'Storyboard (Kuro)',
};

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
const tags = (text: string) => text.split(/[\s,]+/).filter(Boolean);

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string | undefined;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
      {error && (
        <small className="field-error" role="alert">
          {error}
        </small>
      )}
    </label>
  );
}

function Editor({
  campaign,
  section,
  onSaved,
  onDeleted,
}: {
  campaign: CampaignView | null;
  section: 'product' | 'content';
  onSaved: (c: CampaignView) => void;
  onDeleted: () => void;
}) {
  const start = campaign?.config ?? emptyCampaign();
  const [draft, setDraft] = useState<CampaignInput>(start);
  const [hooks, setHooks] = useState(start.content.hooks.join('\n'));
  const [hashtags, setHashtags] = useState(start.content.hashtags.join(' '));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [baseline] = useState(() => JSON.stringify(start));

  const built: CampaignInput = {
    ...draft,
    content: {
      ...draft.content,
      hooks: lines(hooks),
      hashtags: tags(hashtags),
    },
  };
  const dirty = JSON.stringify(built) !== baseline;
  const setProduct = (patch: Partial<CampaignInput['product']>) =>
    setDraft((d) => ({ ...d, product: { ...d.product, ...patch } }));
  const setContent = (patch: Partial<CampaignInput['content']>) =>
    setDraft((d) => ({ ...d, content: { ...d.content, ...patch } }));
  const err = (path: string) => errors[path];

  const save = async () => {
    const parsed = campaignInputSchema.safeParse(built);
    setMessage('');
    if (!parsed.success) {
      const found: Record<string, string> = {};
      for (const i of parsed.error.issues)
        found[i.path.join('.')] ??= i.message;
      setErrors(found);
      setMessage('Periksa isian yang ditandai.');
      return;
    }
    setErrors({});
    setBusy(true);
    const out = campaign
      ? await campaignActions.save(campaign.id, campaign.version, parsed.data)
      : await campaignActions.create(parsed.data);
    setBusy(false);
    if ('error' in out) {
      setErrors(out.fields);
      setMessage(out.error);
    } else if (out.campaign) onSaved(out.campaign);
  };

  const act = async (
    work: (c: CampaignView) => ReturnType<typeof campaignActions.approve>,
  ) => {
    if (!campaign) return;
    setBusy(true);
    setMessage('');
    const out = await work(campaign);
    setBusy(false);
    if ('error' in out) setMessage(out.error);
    else if (out.campaign) onSaved(out.campaign);
  };

  const download = () => {
    const text = [
      built.content.caption,
      built.content.hashtags
        .map((h) => (h.startsWith('#') ? h : `#${h}`))
        .join(' '),
      built.affiliateLink && `Link: ${built.affiliateLink}`,
    ]
      .filter(Boolean)
      .join('\n\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${built.name || 'campaign'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saved = campaign !== null && !dirty;

  return (
    <div className="agent-panel">
      {campaign && (
        <div className="status-row">
          <span
            className={`chip ${campaign.status === 'approved' ? 'configured' : ''}`}
          >
            {campaign.status === 'approved' ? 'Disetujui' : 'Draft'}
          </span>
          {campaign.aiDraft && (
            <span className="chip">Draf AI · belum Anda edit</span>
          )}
        </div>
      )}

      {section === 'product' && (
        <>
          <Field label="Nama campaign" error={err('name')}>
            <input
              value={draft.name}
              maxLength={80}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <div className="field-pair">
            <Field label="Platform">
              <select
                value={draft.platform}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    platform: e.target.value as CampaignInput['platform'],
                  })
                }
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {platformLabel[p]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Harga (Rp)" error={err('product.priceIdr')}>
              <input
                type="number"
                min={0}
                value={draft.product.priceIdr ?? ''}
                onChange={(e) =>
                  setProduct({
                    priceIdr:
                      e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
            </Field>
          </div>
          <Field label="Nama produk" error={err('product.name')}>
            <input
              value={draft.product.name}
              maxLength={120}
              onChange={(e) => setProduct({ name: e.target.value })}
            />
          </Field>
          <Field
            label="Link produk"
            error={err('product.url')}
            hint="Hanya disimpan. Server tidak membuka atau mengambil isi link ini."
          >
            <input
              value={draft.product.url}
              placeholder="https://"
              onChange={(e) => setProduct({ url: e.target.value })}
            />
          </Field>
          <Field label="Link afiliasi" error={err('affiliateLink')}>
            <input
              value={draft.affiliateLink}
              placeholder="https://"
              onChange={(e) =>
                setDraft({ ...draft, affiliateLink: e.target.value })
              }
            />
          </Field>
          <Field label="Manfaat utama" error={err('product.benefits')}>
            <textarea
              rows={3}
              value={draft.product.benefits}
              onChange={(e) => setProduct({ benefits: e.target.value })}
            />
          </Field>
          <Field label="Target pembeli" error={err('product.targetBuyer')}>
            <input
              value={draft.product.targetBuyer}
              onChange={(e) => setProduct({ targetBuyer: e.target.value })}
            />
          </Field>
          <Field label="Catatan" error={err('product.notes')}>
            <textarea
              rows={2}
              value={draft.product.notes}
              onChange={(e) => setProduct({ notes: e.target.value })}
            />
          </Field>
        </>
      )}

      {section === 'content' && (
        <>
          <p className="section-note">
            Draf AI hanya muncul bila agent terkait sudah diatur di Tim & agent
            (provider Anthropic, model, anggaran token) dan kunci API ada di
            server. Semua teks bisa Anda edit; tidak ada yang diposting
            otomatis.
          </p>
          <div className="task-actions">
            {GENERATE_KINDS.map((kind) => (
              <button
                key={kind}
                className="button"
                disabled={!saved || busy}
                title={saved ? '' : 'Simpan campaign dulu'}
                onClick={() =>
                  void act((c) =>
                    campaignActions.generate(c.id, c.version, kind),
                  )
                }
              >
                {busy ? '…' : `Buat draf: ${kindLabel[kind]}`}
              </button>
            ))}
          </div>
          {!saved && (
            <small className="section-note">
              {campaign
                ? 'Simpan perubahan dulu sebelum meminta draf AI.'
                : 'Simpan campaign di tab Product dulu.'}
            </small>
          )}
          <Field label="Hook (satu per baris)" error={err('content.hooks')}>
            <textarea
              rows={3}
              value={hooks}
              onChange={(e) => setHooks(e.target.value)}
            />
          </Field>
          <Field label="Script" error={err('content.script')}>
            <textarea
              rows={6}
              value={draft.content.script}
              onChange={(e) => setContent({ script: e.target.value })}
            />
          </Field>
          <Field label="CTA" error={err('content.cta')}>
            <input
              value={draft.content.cta}
              onChange={(e) => setContent({ cta: e.target.value })}
            />
          </Field>
          <Field label="Caption" error={err('content.caption')}>
            <textarea
              rows={4}
              value={draft.content.caption}
              onChange={(e) => setContent({ caption: e.target.value })}
            />
          </Field>
          <Field
            label="Hashtag"
            error={err('content.hashtags')}
            hint="Pisahkan dengan spasi."
          >
            <input
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
            />
          </Field>
          <fieldset className="check-group">
            <legend>Storyboard</legend>
            {draft.content.storyboard.map((scene, i) => (
              <div className="scene" key={i}>
                <strong>Scene {i + 1}</strong>
                <textarea
                  rows={2}
                  aria-label={`Visual scene ${i + 1}`}
                  placeholder="Visual"
                  value={scene.visual}
                  onChange={(e) =>
                    setContent({
                      storyboard: draft.content.storyboard.map((s, j) =>
                        j === i ? { ...s, visual: e.target.value } : s,
                      ),
                    })
                  }
                />
                <textarea
                  rows={2}
                  aria-label={`Voice-over scene ${i + 1}`}
                  placeholder="Voice-over"
                  value={scene.voiceover}
                  onChange={(e) =>
                    setContent({
                      storyboard: draft.content.storyboard.map((s, j) =>
                        j === i ? { ...s, voiceover: e.target.value } : s,
                      ),
                    })
                  }
                />
                <div className="task-actions">
                  <input
                    type="number"
                    min={1}
                    max={120}
                    aria-label={`Detik scene ${i + 1}`}
                    value={scene.seconds}
                    onChange={(e) =>
                      setContent({
                        storyboard: draft.content.storyboard.map((s, j) =>
                          j === i
                            ? { ...s, seconds: Number(e.target.value) }
                            : s,
                        ),
                      })
                    }
                  />
                  <button
                    className="button"
                    onClick={() =>
                      setContent({
                        storyboard: draft.content.storyboard.filter(
                          (_, j) => j !== i,
                        ),
                      })
                    }
                  >
                    Hapus scene
                  </button>
                </div>
              </div>
            ))}
            <button
              className="button"
              onClick={() =>
                setContent({
                  storyboard: [
                    ...draft.content.storyboard,
                    { visual: '', voiceover: '', seconds: 3 },
                  ],
                })
              }
            >
              + Tambah scene
            </button>
          </fieldset>
        </>
      )}

      <div className="drawer-footer">
        <span className="drawer-message" role="status">
          {message || (dirty ? 'Ada perubahan belum disimpan.' : '')}
        </span>
        <div className="task-actions">
          {campaign && (
            <button
              className="button"
              onClick={() => {
                if (window.confirm(`Hapus campaign ${campaign.config.name}?`))
                  void campaignActions.remove(campaign.id).then(onDeleted);
              }}
            >
              Hapus
            </button>
          )}
          {section === 'content' && campaign && (
            <button className="button" onClick={download}>
              Unduh caption (.txt)
            </button>
          )}
          {saved && campaign.status !== 'approved' && (
            <button
              className="button"
              disabled={busy}
              onClick={() =>
                void act((c) => campaignActions.approve(c.id, c.version))
              }
            >
              Setujui
            </button>
          )}
          <button
            className="button button-dark"
            disabled={busy || (campaign !== null && !dirty)}
            onClick={() => void save()}
          >
            {busy ? 'Menyimpan…' : campaign ? 'Simpan' : 'Buat campaign'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AffiliatePage() {
  const { status, campaigns, error } = useCampaigns();
  const agents = useAgents();
  const [section, setSection] = useState<Section>('library');
  const [currentId, setCurrentId] = useState<string | null>(null);
  const current = campaigns.find((c) => c.id === currentId) ?? null;
  const open = (id: string | null, to: Section = 'product') => {
    setCurrentId(id);
    setSection(to);
  };

  return (
    <section className="team-page">
      <div className="section-heading">
        <h2>AI Affiliate Studio</h2>
        <button className="button button-dark" onClick={() => open(null)}>
          + Campaign baru
        </button>
      </div>
      <p className="section-note">
        Fase 1: input produk, link afiliasi, draf script, caption dan storyboard
        yang bisa Anda edit dan setujui. Editor video, musik, voice-over, tren,
        dan analytics belum tersedia. Posting dilakukan manual oleh Anda.
      </p>

      <div
        className="tab-row"
        role="tablist"
        aria-label="Bagian Affiliate Studio"
      >
        {sections.map((s) => (
          <button
            key={s.id}
            role="tab"
            className="tab"
            aria-selected={section === s.id}
            disabled={!s.ready}
            title={s.ready ? '' : 'Fase berikutnya'}
            onClick={() => setSection(s.id)}
          >
            {s.label}
            {!s.ready && <small> · segera</small>}
          </button>
        ))}
      </div>

      {status === 'loading' && (
        <p className="section-note" role="status">
          Memuat campaign…
        </p>
      )}
      {status === 'error' && (
        <div className="stats-empty" role="alert">
          <p>Campaign tidak bisa dimuat: {error}</p>
          <button
            className="button"
            onClick={() => void campaignActions.load()}
          >
            Coba lagi
          </button>
        </div>
      )}

      {status === 'ready' && section === 'library' && (
        <>
          {campaigns.length === 0 ? (
            <div className="stats-empty">
              <p>Belum ada campaign. Mulai dari produk pertama Anda.</p>
              <button className="button button-dark" onClick={() => open(null)}>
                + Campaign baru
              </button>
            </div>
          ) : (
            <ul className="agent-grid">
              {campaigns.map((c) => (
                <li key={c.id} className="agent-card">
                  <button
                    className="agent-main"
                    onClick={() => open(c.id, 'content')}
                  >
                    <span className="member-copy">
                      <strong>{c.config.name}</strong>
                      <span>{c.config.product.name}</span>
                      <small>{platformLabel[c.config.platform]}</small>
                    </span>
                  </button>
                  <div className="status-row">
                    <span
                      className={`chip ${c.status === 'approved' ? 'configured' : ''}`}
                    >
                      {c.status === 'approved' ? 'Disetujui' : 'Draft'}
                    </span>
                    {c.aiDraft && <span className="chip">Draf AI</span>}
                  </div>
                  <div className="task-actions">
                    <button className="button" onClick={() => open(c.id)}>
                      Produk
                    </button>
                    <button
                      className="button"
                      onClick={() => open(c.id, 'content')}
                    >
                      Konten
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {status === 'ready' &&
        (section === 'product' || section === 'content') && (
          <>
            {section === 'content' && !current && (
              <p className="section-note">
                Pilih campaign dari Content Library, atau buat yang baru di tab
                Product.
              </p>
            )}
            {(section === 'product' || current) && (
              <Editor
                key={`${current?.id ?? 'new'}:${current?.version ?? 0}`}
                campaign={current}
                section={section}
                onSaved={(c) => setCurrentId(c.id)}
                onDeleted={() => open(null, 'library')}
              />
            )}
            {section === 'content' && current && agents.status === 'ready' && (
              <p className="section-note">
                {['aeri', 'kuro']
                  .map((id) => agents.agents.find((a) => a.id === id))
                  .filter((a) => a)
                  .map(
                    (a) =>
                      `${a!.config.displayName}: ${a!.configStatus === 'configured' ? 'terkonfigurasi' : 'belum dikonfigurasi'}`,
                  )
                  .join(' · ')}
              </p>
            )}
          </>
        )}
    </section>
  );
}
