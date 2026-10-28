import { useEffect, useState, type ReactNode } from 'react';
import {
  DURATIONS,
  GENERATE_KINDS,
  PLATFORMS,
  RATIOS,
  SPEAKING_STYLES,
  TEMPLATES,
  VIDEO_STYLES,
  VOICES,
  campaignInputSchema,
  emptyCampaign,
  platformLabel,
  scaffold,
  suggestHashtags,
  type CampaignInput,
  type CampaignView,
  type GenerateKind,
} from '@204/contracts';
import { request } from '../tasks/store';
import { campaignActions, useCampaigns } from './store';
import { AssetManager } from './AssetManager';
import { PresenterStudio } from './PresenterStudio';
import { usePresenters } from './presenterStore';
import { VideoStudio } from './VideoStudio';
import { fileUrl, useStudioData, type Asset } from './studioData';

type Tab =
  | 'home'
  | 'presenter'
  | 'product'
  | 'storyboard'
  | 'voice'
  | 'video'
  | 'library';
const tabs: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Beranda' },
  { id: 'presenter', label: 'AI Presenter Studio' },
  { id: 'product', label: 'Product Studio' },
  { id: 'storyboard', label: 'Storyboard & Template' },
  { id: 'voice', label: 'Suara AI' },
  { id: 'video', label: 'Edit & Ekspor Video' },
  { id: 'library', label: 'Content Library' },
];

// What each module can do today, so nothing looks finished that is not.
const modules: {
  title: string;
  text: string;
  state: 'aktif' | 'sebagian' | 'segera';
  tab: Tab | null;
  note: string;
}[] = [
  {
    title: 'AI Presenter Studio',
    text: 'Profil presenter dengan foto referensi, dipakai ulang antar campaign.',
    state: 'sebagian',
    tab: 'presenter',
    note: 'Presenter berbicara dan wajah konsisten dari AI: fase 2 (berbayar).',
  },
  {
    title: 'Product Studio',
    text: 'Data produk, link afiliasi, foto dan video produk, latar polos.',
    state: 'aktif',
    tab: 'product',
    note: 'Foto produk asli dipakai apa adanya supaya bentuknya tidak berubah.',
  },
  {
    title: 'Storyboard & Template',
    text: 'Template konten, durasi, gaya, dan scene yang bisa diedit.',
    state: 'aktif',
    tab: 'storyboard',
    note: 'Kerangka dari template, bukan AI. Draf AI opsional dan berbayar.',
  },
  {
    title: 'Suara AI',
    text: 'Pilih suara dan gaya bicara, edit narasi per scene.',
    state: 'sebagian',
    tab: 'voice',
    note: 'Pratinjau dan pembuatan suara: fase 2 (Gemini TTS gratis berkuota).',
  },
  {
    title: 'Video dari Foto / Teks',
    text: 'Susun foto atau klip menjadi video 9:16 dengan subtitle.',
    state: 'sebagian',
    tab: 'video',
    note: 'Dari foto: aktif. Dari teks saja butuh AI video: berbayar.',
  },
  {
    title: 'Edit & Gabung Video',
    text: 'Scene, trim klip, teks, musik, transisi, ekspor MP4.',
    state: 'aktif',
    tab: 'video',
    note: 'Berjalan lokal dengan FFmpeg, biaya Rp0.',
  },
  {
    title: 'Content Library',
    text: 'Semua campaign, presenter, dan hasil ekspor.',
    state: 'aktif',
    tab: 'library',
    note: '',
  },
  {
    title: 'Gambar AI',
    text: 'Latar dan gambar dari prompt.',
    state: 'segera',
    tab: null,
    note: 'Fase 2: opsi gratis Cloudflare Flux atau berbayar Gemini.',
  },
  {
    title: 'Auto Post',
    text: 'Unggah otomatis ke platform.',
    state: 'segera',
    tab: null,
    note: 'Fase 3. Sekarang unduh lalu posting manual.',
  },
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
  hint?: string | undefined;
  children: ReactNode;
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

// Campaigns saved before the studio existed have no studio block or scene extras.
const normalize = (config: CampaignInput): CampaignInput => {
  const fresh = emptyCampaign();
  return {
    ...config,
    studio: { ...fresh.studio, ...config.studio },
    content: {
      ...config.content,
      storyboard: config.content.storyboard.map((s) => ({
        ...s,
        text: s.text ?? '',
        assetId: s.assetId ?? null,
        backgroundAssetId: s.backgroundAssetId ?? null,
        trimStart: s.trimStart ?? 0,
      })),
    },
  };
};

type EditorSection = 'product' | 'storyboard' | 'voice';

// One draft of the whole campaign, saved as a unit; each tab shows its own part of it.
function Editor({
  campaign,
  section,
  assets,
  onSaved,
  onDeleted,
}: {
  campaign: CampaignView | null;
  section: EditorSection;
  assets: Asset[];
  onSaved: (c: CampaignView) => void;
  onDeleted: () => void;
}) {
  const start = normalize(campaign?.config ?? emptyCampaign());
  const [draft, setDraft] = useState<CampaignInput>(start);
  const [hooks, setHooks] = useState(start.content.hooks.join('\n'));
  const [hashtags, setHashtags] = useState(start.content.hashtags.join(' '));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [baseline] = useState(() => JSON.stringify(start));
  const presenters = usePresenters();

  const built: CampaignInput = {
    ...draft,
    content: {
      ...draft.content,
      hooks: lines(hooks),
      hashtags: tags(hashtags),
    },
  };
  const dirty = JSON.stringify(built) !== baseline;
  const saved = campaign !== null && !dirty;
  const studio = draft.studio;
  const scenes = draft.content.storyboard;
  const setProduct = (patch: Partial<CampaignInput['product']>) =>
    setDraft((d) => ({ ...d, product: { ...d.product, ...patch } }));
  const setStudio = (patch: Partial<CampaignInput['studio']>) =>
    setDraft((d) => ({ ...d, studio: { ...d.studio, ...patch } }));
  const setContent = (patch: Partial<CampaignInput['content']>) =>
    setDraft((d) => ({ ...d, content: { ...d.content, ...patch } }));
  const setScene = (i: number, patch: Partial<(typeof scenes)[number]>) =>
    setContent({
      storyboard: scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    });
  const err = (path: string) => errors[path];

  const picturable = assets.filter(
    (a) => a.mime.startsWith('image/') || a.mime.startsWith('video/'),
  );
  const backdrops = assets.filter((a) => a.kind === 'background');
  const total = scenes.reduce((sum, s) => sum + s.seconds, 0);

  const save = async () => {
    const parsed = campaignInputSchema.safeParse(built);
    setMessage('');
    if (!parsed.success) {
      const found: Record<string, string> = {};
      for (const i of parsed.error.issues)
        found[i.path.join('.')] ??= i.message;
      setErrors(found);
      setMessage('Periksa isian yang ditandai (mungkin di tab lain).');
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

  const generate = async (kind: GenerateKind) => {
    if (!campaign) return;
    if (
      !window.confirm(
        'Draf AI ini memakai API berbayar (Anthropic) dan dikenai biaya sesuai pemakaian token. Lanjutkan hanya bila Anda setuju.',
      )
    )
      return;
    setBusy(true);
    setMessage('');
    const out = await campaignActions.generate(
      campaign.id,
      campaign.version,
      kind,
    );
    setBusy(false);
    if ('error' in out) setMessage(out.error);
    else if (out.campaign) onSaved(out.campaign);
  };
  const approve = async () => {
    if (!campaign) return;
    setBusy(true);
    const out = await campaignActions.approve(campaign.id, campaign.version);
    setBusy(false);
    if ('error' in out) setMessage(out.error);
    else if (out.campaign) onSaved(out.campaign);
  };

  const makeScaffold = () => {
    if (
      scenes.length > 0 &&
      !window.confirm(
        'Kerangka baru akan mengganti storyboard yang ada. Lanjutkan?',
      )
    )
      return;
    const fresh = scaffold(
      studio.template,
      draft.product,
      studio.durationSeconds,
    );
    const stills = assets.filter(
      (a) => a.kind === 'product' || a.kind === 'export',
    );
    const faces = assets.filter((a) => a.kind === 'presenter');
    // A scene about the presenter gets a presenter photo, the others rotate through product media.
    let p = 0;
    setContent({
      storyboard: fresh.map((s) => {
        const person = /presenter|orang|penjual/i.test(s.visual);
        const pool = person && faces.length ? faces : stills;
        return {
          ...s,
          assetId: pool.length ? pool[p++ % pool.length]!.id : null,
        };
      }),
    });
    if (!hashtags.trim())
      setHashtags(suggestHashtags(draft.product, studio.template).join(' '));
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
          <Field
            label="Manfaat dan keunggulan (satu per baris)"
            error={err('product.benefits')}
          >
            <textarea
              rows={3}
              value={draft.product.benefits}
              onChange={(e) => setProduct({ benefits: e.target.value })}
            />
          </Field>
          <Field label="Target pasar" error={err('product.targetBuyer')}>
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

      {section === 'storyboard' && (
        <>
          <p className="section-note">
            Kerangka dari template berisi teks isian dari data produk, bukan
            hasil AI, dan semuanya bisa Anda edit.
          </p>
          <div className="field-pair">
            <Field
              label="Template"
              hint={TEMPLATES.find((t) => t.id === studio.template)?.hint}
            >
              <select
                value={studio.template}
                onChange={(e) =>
                  setStudio({
                    template: e.target.value as typeof studio.template,
                  })
                }
              >
                {TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Gaya video">
              <select
                value={studio.style}
                onChange={(e) =>
                  setStudio({ style: e.target.value as typeof studio.style })
                }
              >
                {VIDEO_STYLES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <fieldset className="check-group">
            <legend>Durasi</legend>
            <div className="filter-row" role="group" aria-label="Durasi video">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  className="button"
                  aria-pressed={studio.durationSeconds === d}
                  onClick={() => setStudio({ durationSeconds: d })}
                >
                  {d} dtk
                </button>
              ))}
            </div>
          </fieldset>
          <div className="field-pair">
            <Field label="Rasio">
              <select value={studio.ratio} onChange={() => undefined}>
                {RATIOS.map((r) => (
                  <option key={r.id} value={r.id} disabled={!r.ready}>
                    {r.label}
                    {r.ready ? '' : ' (segera)'}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Angle promosi"
              hint="Misalnya: hemat, praktis, untuk pemula."
            >
              <input
                value={studio.angle}
                maxLength={200}
                onChange={(e) => setStudio({ angle: e.target.value })}
              />
            </Field>
          </div>
          <div className="field-pair">
            <Field label="Presenter">
              <select
                value={studio.presenterId ?? ''}
                onChange={(e) =>
                  setStudio({ presenterId: e.target.value || null })
                }
              >
                <option value="">Tanpa presenter</option>
                {presenters.presenters.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Latar utama"
              hint="Dipakai semua scene kecuali scene punya latar sendiri."
            >
              <select
                value={studio.backgroundAssetId ?? ''}
                onChange={(e) =>
                  setStudio({ backgroundAssetId: e.target.value || null })
                }
              >
                <option value="">Tanpa latar (foto memenuhi layar)</option>
                {backdrops.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="task-actions">
            <button className="button" onClick={makeScaffold}>
              Buat kerangka dari template
            </button>
            <button
              className="button"
              onClick={() =>
                setHashtags(
                  suggestHashtags(draft.product, studio.template).join(' '),
                )
              }
            >
              Saran hashtag
            </button>
          </div>

          <fieldset className="check-group">
            <legend>
              Scene · {total} dtk dari target {studio.durationSeconds} dtk
            </legend>
            {scenes.length === 0 && (
              <small>
                Belum ada scene. Buat kerangka dari template atau tambah manual.
              </small>
            )}
            {scenes.map((scene, i) => {
              const chosen = assets.find((a) => a.id === scene.assetId);
              return (
                <div className="scene" key={i}>
                  <strong>Scene {i + 1}</strong>
                  <textarea
                    rows={2}
                    aria-label={`Visual scene ${i + 1}`}
                    placeholder="Visual / adegan"
                    value={scene.visual}
                    onChange={(e) => setScene(i, { visual: e.target.value })}
                  />
                  <input
                    aria-label={`Teks di layar scene ${i + 1}`}
                    placeholder="Teks di layar (subtitle)"
                    value={scene.text}
                    maxLength={200}
                    onChange={(e) => setScene(i, { text: e.target.value })}
                  />
                  <select
                    aria-label={`Foto scene ${i + 1}`}
                    value={scene.assetId ?? ''}
                    onChange={(e) =>
                      setScene(i, { assetId: e.target.value || null })
                    }
                  >
                    <option value="">Foto/video: belum dipilih</option>
                    {picturable.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.kind} · {a.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Latar scene ${i + 1}`}
                    value={scene.backgroundAssetId ?? ''}
                    onChange={(e) =>
                      setScene(i, { backgroundAssetId: e.target.value || null })
                    }
                  >
                    <option value="">Latar: ikuti latar utama</option>
                    {backdrops.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <div className="task-actions">
                    <input
                      type="number"
                      min={1}
                      max={15}
                      aria-label={`Detik scene ${i + 1}`}
                      value={scene.seconds}
                      onChange={(e) =>
                        setScene(i, {
                          seconds: Math.max(
                            1,
                            Math.min(15, Number(e.target.value) || 1),
                          ),
                        })
                      }
                    />
                    {chosen?.mime.startsWith('video/') && (
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        aria-label={`Mulai detik scene ${i + 1}`}
                        title="Mulai dari detik ke"
                        value={scene.trimStart}
                        onChange={(e) =>
                          setScene(i, {
                            trimStart: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                      />
                    )}
                    <button
                      className="button"
                      disabled={i === 0}
                      onClick={() =>
                        setContent({
                          storyboard: scenes.map(
                            (_, j) =>
                              scenes[j === i ? i - 1 : j === i - 1 ? i : j]!,
                          ),
                        })
                      }
                    >
                      ↑
                    </button>
                    <button
                      className="button"
                      disabled={i === scenes.length - 1}
                      onClick={() =>
                        setContent({
                          storyboard: scenes.map(
                            (_, j) =>
                              scenes[j === i ? i + 1 : j === i + 1 ? i : j]!,
                          ),
                        })
                      }
                    >
                      ↓
                    </button>
                    <button
                      className="button"
                      onClick={() =>
                        setContent({
                          storyboard: scenes.filter((_, j) => j !== i),
                        })
                      }
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}
            <button
              className="button"
              onClick={() =>
                setContent({
                  storyboard: [
                    ...scenes,
                    {
                      visual: '',
                      voiceover: '',
                      seconds: 3,
                      text: '',
                      assetId: null,
                      backgroundAssetId: null,
                      trimStart: 0,
                    },
                  ],
                })
              }
            >
              + Tambah scene
            </button>
          </fieldset>

          <h3 className="drawer-h3">Naskah, caption, dan hashtag</h3>
          <div className="task-actions">
            {GENERATE_KINDS.map((kind) => (
              <button
                key={kind}
                className="button"
                disabled={!saved || busy}
                title={
                  saved
                    ? 'Berbayar (Anthropic), perlu persetujuan'
                    : 'Simpan campaign dulu'
                }
                onClick={() => void generate(kind)}
              >
                Draf AI berbayar: {kindLabel[kind]}
              </button>
            ))}
          </div>
          <small className="section-note">
            Draf AI memakai API berbayar dan baru jalan bila agent dan kunci
            diatur; Anda akan diminta setuju setiap kali. Pilihan gratis
            menyusul di fase berikutnya.
          </small>
          <Field label="Hook (satu per baris)" error={err('content.hooks')}>
            <textarea
              rows={3}
              value={hooks}
              onChange={(e) => setHooks(e.target.value)}
            />
          </Field>
          <Field label="Script" error={err('content.script')}>
            <textarea
              rows={5}
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
            hint="Pisahkan dengan spasi. Saran dibuat dari kata produk dan template, bukan data tren."
          >
            <input
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
            />
          </Field>
        </>
      )}

      {section === 'voice' && (
        <>
          <p className="section-note">
            Pilihan suara disimpan di campaign. Pratinjau dan pembuatan suara
            belum aktif: fase 2 memakai Gemini TTS (ada tier gratis berkuota,
            bahasa Indonesia didukung). Dokumentasi Gemini tidak memberi label
            cewek/cowok, jadi pemetaannya menunggu uji dengar bersama Anda.
          </p>
          <Field label="Gaya bicara">
            <select
              value={studio.voiceStyle}
              onChange={(e) =>
                setStudio({
                  voiceStyle: e.target.value as typeof studio.voiceStyle,
                })
              }
            >
              {SPEAKING_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <fieldset className="check-group">
            <legend>Suara ({VOICES.length} tersedia di Gemini)</legend>
            <div className="voice-grid">
              {VOICES.map((v) => (
                <label key={v.id} className="check">
                  <input
                    type="radio"
                    name="voice"
                    checked={studio.voiceId === v.id}
                    onChange={() => setStudio({ voiceId: v.id })}
                  />
                  <span>
                    {v.id} <small>{v.tone}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="check-group">
            <legend>Narasi per scene (edit sebelum dibuat suaranya)</legend>
            {scenes.length === 0 && (
              <small>Belum ada scene. Buat storyboard dulu.</small>
            )}
            {scenes.map((scene, i) => {
              const seconds = Math.round(
                scene.voiceover.split(/\s+/).filter(Boolean).length / 2.5,
              );
              return (
                <label className="field" key={i}>
                  <span>
                    Scene {i + 1} · {scene.seconds} dtk
                  </span>
                  <textarea
                    rows={2}
                    value={scene.voiceover}
                    onChange={(e) => setScene(i, { voiceover: e.target.value })}
                  />
                  <small
                    className={
                      seconds > scene.seconds * 1.15 ? 'field-error' : ''
                    }
                  >
                    Perkiraan {seconds} dtk dibacakan (±2,5 kata per detik)
                    {seconds > scene.seconds * 1.15
                      ? ': terlalu panjang untuk scene ini'
                      : ''}
                  </small>
                </label>
              );
            })}
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
          {section === 'storyboard' && campaign && (
            <button className="button" onClick={download}>
              Unduh caption (.txt)
            </button>
          )}
          {saved && campaign.status !== 'approved' && (
            <button
              className="button"
              disabled={busy}
              onClick={() => void approve()}
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

type LibraryExport = {
  id: string;
  campaignId: string;
  campaignName: string;
  name: string;
  seconds: number | null;
  createdAt: number;
};

export function AffiliatePage() {
  const { status, campaigns, error } = useCampaigns();
  const presenters = usePresenters();
  const [tab, setTab] = useState<Tab>('home');
  const [currentId, setCurrentId] = useState<string | null>(null);
  const current = campaigns.find((c) => c.id === currentId) ?? null;
  const media = useStudioData(currentId);
  const [exportsList, setExportsList] = useState<LibraryExport[]>([]);

  useEffect(() => {
    if (tab !== 'library') return;
    void request<{ exports: LibraryExport[] }>('GET', '/media/library').then(
      (r) => {
        if (r.ok) setExportsList(r.data.exports);
      },
    );
  }, [tab, campaigns]);

  const open = (id: string | null, to: Tab) => {
    setCurrentId(id);
    setTab(to);
  };
  const needsCampaign = (
    <p className="section-note">
      Pilih campaign di atas, atau buat yang baru di Product Studio.
    </p>
  );

  return (
    <section className="team-page">
      <div className="section-heading">
        <h2>AI Studio</h2>
        <button
          className="button button-dark"
          onClick={() => open(null, 'product')}
        >
          + Campaign baru
        </button>
      </div>
      <label className="field">
        <span>Campaign aktif</span>
        <select
          value={currentId ?? ''}
          onChange={(e) => setCurrentId(e.target.value || null)}
        >
          <option value="">(belum dipilih)</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.config.name} · {platformLabel[c.config.platform]}
            </option>
          ))}
        </select>
      </label>

      <div className="tab-row" role="tablist" aria-label="Modul AI Studio">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            className="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
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

      {status === 'ready' && tab === 'home' && (
        <>
          <p className="section-note">
            Studio konten affiliate dengan prinsip gratis dulu: foto dan video
            asli Anda disusun menjadi video 9:16 di laptop sendiri. Fitur AI
            generatif berbayar tidak pernah jadi syarat, dan tidak ada panggilan
            berbayar tanpa persetujuan Anda. Posting dilakukan manual.
          </p>
          <ul className="agent-grid">
            {modules.map((m) => (
              <li key={m.title} className="agent-card">
                <div>
                  <strong>{m.title}</strong>
                  <p className="section-note">{m.text}</p>
                  {m.note && <small className="section-note">{m.note}</small>}
                </div>
                <div className="status-row">
                  <span
                    className={`chip ${m.state === 'aktif' ? 'configured' : m.state === 'segera' ? 'disabled' : ''}`}
                  >
                    {m.state === 'aktif'
                      ? 'Aktif'
                      : m.state === 'sebagian'
                        ? 'Sebagian aktif'
                        : 'Segera'}
                  </span>
                </div>
                {m.tab && (
                  <div className="task-actions">
                    <button className="button" onClick={() => setTab(m.tab!)}>
                      Buka
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {status === 'ready' && tab === 'presenter' && (
        <PresenterStudio
          campaignId={currentId}
          mediaReady={Boolean(
            media.status?.configured && media.status.ffmpeg.available,
          )}
          onUsed={() => void media.reload()}
        />
      )}

      {status === 'ready' && tab === 'product' && (
        <>
          <Editor
            key={`product:${current?.id ?? 'new'}:${current?.version ?? 0}`}
            campaign={current}
            section="product"
            assets={media.assets}
            onSaved={(c) => setCurrentId(c.id)}
            onDeleted={() => open(null, 'library')}
          />
          {current ? (
            <>
              <h3 className="drawer-h3">Aset produk</h3>
              <AssetManager campaignId={current.id} media={media} />
            </>
          ) : (
            <p className="section-note">
              Simpan campaign dulu untuk mengunggah foto atau video produk.
            </p>
          )}
        </>
      )}

      {status === 'ready' &&
        (tab === 'storyboard' || tab === 'voice') &&
        (current ? (
          <Editor
            key={`${tab}:${current.id}:${current.version}:${media.assets.length}`}
            campaign={current}
            section={tab}
            assets={media.assets}
            onSaved={(c) => setCurrentId(c.id)}
            onDeleted={() => open(null, 'library')}
          />
        ) : (
          needsCampaign
        ))}

      {status === 'ready' &&
        tab === 'video' &&
        (current ? (
          <VideoStudio
            key={current.id + current.version}
            campaign={current}
            media={media}
          />
        ) : (
          needsCampaign
        ))}

      {status === 'ready' && tab === 'library' && (
        <>
          <dl className="agent-counts">
            <div>
              <dt>Campaign</dt>
              <dd>{campaigns.length}</dd>
            </div>
            <div>
              <dt>Presenter</dt>
              <dd>{presenters.presenters.length}</dd>
            </div>
            <div>
              <dt>Video diekspor</dt>
              <dd>{exportsList.length}</dd>
            </div>
          </dl>
          {campaigns.length === 0 ? (
            <div className="stats-empty">
              <p>Belum ada campaign. Mulai dari produk pertama Anda.</p>
              <button
                className="button button-dark"
                onClick={() => open(null, 'product')}
              >
                + Campaign baru
              </button>
            </div>
          ) : (
            <ul className="agent-grid">
              {campaigns.map((c) => (
                <li key={c.id} className="agent-card">
                  <button
                    className="agent-main"
                    onClick={() => open(c.id, 'storyboard')}
                  >
                    <span className="member-copy">
                      <strong>{c.config.name}</strong>
                      <span>{c.config.product.name}</span>
                      <small>
                        {platformLabel[c.config.platform]} ·{' '}
                        {c.config.content.storyboard.length} scene
                      </small>
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
                    <button
                      className="button"
                      onClick={() => open(c.id, 'product')}
                    >
                      Produk
                    </button>
                    <button
                      className="button"
                      onClick={() => open(c.id, 'video')}
                    >
                      Video
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {exportsList.length > 0 && (
            <>
              <h3 className="drawer-h3">Hasil ekspor</h3>
              <ul className="history-list">
                {exportsList.map((x) => (
                  <li key={x.id}>
                    <span>
                      {x.campaignName} · {x.name}
                      {x.seconds ? ` · ${x.seconds.toFixed(0)} dtk` : ''} ·{' '}
                      {new Date(x.createdAt).toLocaleString('id-ID')}
                    </span>
                    <a className="button" href={fileUrl(x.id)} download>
                      Unduh
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
