import { describe, expect, it } from 'vitest';
import {
  campaignInputSchema,
  emptyCampaign,
  sceneSchema,
  studioSchema,
} from './affiliate.js';
import {
  DURATIONS,
  PRESENTER_STYLES,
  SPEAKING_STYLES,
  TEMPLATES,
  VIDEO_STYLES,
  VOICES,
  scaffold,
  sceneCountFor,
  suggestHashtags,
} from './studio.js';

const product = {
  name: 'Botol Minum Termos',
  url: '',
  priceIdr: 89000,
  benefits: 'Tahan panas 12 jam\nAnti bocor',
  targetBuyer: 'anak kantoran',
  notes: '',
};

describe('scaffold', () => {
  it('adds up to the chosen duration for every template and length', () => {
    for (const t of TEMPLATES)
      for (const d of DURATIONS) {
        const scenes = scaffold(t.id, product, d);
        expect(
          scenes.reduce((n, s) => n + s.seconds, 0),
          `${t.id} ${d}`,
        ).toBe(d);
        expect(scenes.length).toBeLessThanOrEqual(sceneCountFor(d));
        expect(
          scenes.every(
            (s) => s.seconds >= 1 && sceneSchema.safeParse(s).success,
          ),
        ).toBe(true);
      }
  });
  it('fills the product into the text and keeps the first and last beats', () => {
    const scenes = scaffold('affiliate-promo', product, 20);
    expect(scenes[0]!.voiceover).toContain('Botol Minum Termos');
    expect(scenes.some((s) => s.voiceover.includes('Tahan panas 12 jam'))).toBe(
      true,
    );
    expect(scenes.at(-1)!.voiceover.toLowerCase()).toContain('link');
    expect(JSON.stringify(scenes)).not.toMatch(/\{\w+\}/);
  });
  it('skips the price scene when there is no price and never leaves an empty slot', () => {
    const scenes = scaffold(
      'demo',
      { ...product, priceIdr: null, benefits: '', targetBuyer: '' },
      45,
    );
    expect(scenes.some((s) => /harga/i.test(s.voiceover))).toBe(false);
    expect(JSON.stringify(scenes)).not.toMatch(/\{\w+\}/);
  });
});

describe('hashtags and catalogs', () => {
  it('comes from the product words and the template, at most 8', () => {
    const tags = suggestHashtags(product, 'review-jujur');
    expect(tags).toContain('botol');
    expect(tags).toContain('review');
    expect(tags.length).toBeLessThanOrEqual(8);
    expect(tags.every((t) => /^[\p{L}\p{N}]+$/u.test(t))).toBe(true);
  });
  it('lists 30 voices with no invented gender', () => {
    expect(VOICES).toHaveLength(30);
    expect(VOICES.every((v) => v.gender === null)).toBe(true);
  });
  it('keeps the schema in step with the catalog ids', () => {
    for (const t of TEMPLATES)
      expect(studioSchema.safeParse({ template: t.id }).success).toBe(true);
    for (const s of VIDEO_STYLES)
      expect(studioSchema.safeParse({ style: s.id }).success).toBe(true);
    for (const s of SPEAKING_STYLES)
      expect(studioSchema.safeParse({ voiceStyle: s.id }).success).toBe(true);
    for (const d of DURATIONS)
      expect(studioSchema.safeParse({ durationSeconds: d }).success).toBe(true);
    expect(studioSchema.safeParse({ durationSeconds: 25 }).success).toBe(false);
    expect(PRESENTER_STYLES).toHaveLength(4);
  });
});

describe('older campaigns', () => {
  it('get the studio defaults and scene defaults when saved again', () => {
    const old: Record<string, unknown> & {
      product: ReturnType<typeof emptyCampaign>['product'];
      content: ReturnType<typeof emptyCampaign>['content'];
    } = { ...emptyCampaign() };
    delete old.studio;
    const parsed = campaignInputSchema.parse({
      ...old,
      name: 'Lama',
      product: { ...old.product, name: 'Kopi' },
      content: {
        ...old.content,
        storyboard: [{ visual: 'a', voiceover: 'b', seconds: 3 }],
      },
    });
    expect(parsed.studio).toMatchObject({
      durationSeconds: 30,
      ratio: '9:16',
      template: 'affiliate-promo',
    });
    expect(parsed.content.storyboard[0]).toMatchObject({
      text: '',
      assetId: null,
      backgroundAssetId: null,
      trimStart: 0,
    });
  });
});
