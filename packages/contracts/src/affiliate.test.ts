import { describe, expect, it } from 'vitest';
import { applyDraft, campaignInputSchema, emptyCampaign } from './affiliate.js';

const valid = () => ({
  ...emptyCampaign(),
  name: 'Promo Mei',
  product: { ...emptyCampaign().product, name: 'Botol minum' },
});

describe('campaign schema', () => {
  it('accepts a minimal campaign', () =>
    expect(campaignInputSchema.safeParse(valid()).success).toBe(true));
  it('refuses non-web links', () => {
    expect(
      campaignInputSchema.safeParse({
        ...valid(),
        affiliateLink: 'javascript:alert(1)',
      }).success,
    ).toBe(false);
    expect(
      campaignInputSchema.safeParse({
        ...valid(),
        affiliateLink: 'https://shope.ee/abc',
      }).success,
    ).toBe(true);
  });
  it('refuses bad hashtags and empty product names', () => {
    const c = valid();
    expect(
      campaignInputSchema.safeParse({
        ...c,
        content: { ...c.content, hashtags: ['bad tag!'] },
      }).success,
    ).toBe(false);
    expect(
      campaignInputSchema.safeParse({
        ...c,
        product: { ...c.product, name: '' },
      }).success,
    ).toBe(false);
  });
});

describe('applyDraft', () => {
  it('merges only the asked part and rejects malformed AI output', () => {
    const base = { ...valid().content, caption: 'lama' };
    const out = applyDraft(base, 'script', {
      hooks: ['h'],
      script: 's',
      cta: 'c',
    });
    expect(out.script).toBe('s');
    expect(out.caption).toBe('lama');
    expect(() => applyDraft(base, 'storyboard', { storyboard: [] })).toThrow();
    expect(() => applyDraft(base, 'script', { nope: 1 })).toThrow();
  });
});
