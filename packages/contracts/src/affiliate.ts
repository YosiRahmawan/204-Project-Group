// AI Affiliate Studio, phase 1: a campaign is one product, its affiliate link and the content
// drafted for it. Everything here is Leo's own input or an AI draft Leo can edit and approve.
import { z } from 'zod';

export const PLATFORMS = ['tiktok', 'shopee'] as const;
export const platformLabel = {
  tiktok: 'TikTok Shop',
  shopee: 'Shopee',
} as const;
export const CAMPAIGN_STATUS = ['draft', 'approved'] as const;
export const GENERATE_KINDS = ['script', 'caption', 'storyboard'] as const;
export type GenerateKind = (typeof GENERATE_KINDS)[number];

// Only web links; the server never opens them (no scraping), it just keeps them for the export.
const webLink = z
  .string()
  .trim()
  .max(1000)
  .refine((value) => {
    if (value === '') return true;
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, 'Harus berupa link http atau https');

// One scene of the storyboard, which is also the video timeline: the photo or clip it shows,
// an optional backdrop behind it, the on-screen text, and the narration line for later.
export const sceneSchema = z.object({
  visual: z.string().trim().max(500),
  voiceover: z.string().trim().max(500),
  seconds: z.number().int().min(1).max(120),
  text: z.string().trim().max(200).default(''),
  assetId: z.string().uuid().nullable().default(null),
  backgroundAssetId: z.string().uuid().nullable().default(null),
  trimStart: z.number().min(0).max(3600).default(0),
});

export const studioSchema = z.object({
  presenterId: z.string().uuid().nullable().default(null),
  backgroundAssetId: z.string().uuid().nullable().default(null),
  durationSeconds: z
    .union([
      z.literal(10),
      z.literal(15),
      z.literal(20),
      z.literal(30),
      z.literal(45),
      z.literal(60),
    ])
    .default(30),
  ratio: z.literal('9:16').default('9:16'),
  style: z
    .enum([
      'promo',
      'storytelling',
      'review',
      'demo',
      'problem-solution',
      'ugc',
      'soft-sell',
    ])
    .default('promo'),
  template: z
    .enum([
      'affiliate-promo',
      'review-jujur',
      'problem-solution',
      'before-after',
      'demo',
      'ugc',
    ])
    .default('affiliate-promo'),
  angle: z.string().trim().max(200).default(''),
  voiceId: z.string().max(40).nullable().default(null),
  voiceStyle: z
    .enum(['santai', 'energik', 'tenang', 'profesional'])
    .default('santai'),
});

export const campaignInputSchema = z.object({
  name: z.string().trim().min(2, 'Minimal 2 karakter').max(80),
  platform: z.enum(PLATFORMS),
  product: z.object({
    name: z.string().trim().min(2, 'Nama produk wajib diisi').max(120),
    url: webLink,
    priceIdr: z.number().int().min(0).max(1_000_000_000).nullable(),
    benefits: z.string().trim().max(1500),
    targetBuyer: z.string().trim().max(500),
    notes: z.string().trim().max(1500),
  }),
  affiliateLink: webLink,
  studio: studioSchema.default(() => studioSchema.parse({})),
  content: z.object({
    hooks: z.array(z.string().trim().max(300)).max(10),
    script: z.string().trim().max(4000),
    storyboard: z.array(sceneSchema).max(20),
    caption: z.string().trim().max(2200),
    hashtags: z
      .array(
        z
          .string()
          .trim()
          .regex(/^#?[\p{L}\p{N}_]{1,50}$/u, 'Hashtag tidak valid'),
      )
      .max(30),
    cta: z.string().trim().max(300),
  }),
});
export type CampaignInput = z.infer<typeof campaignInputSchema>;

export type CampaignView = {
  id: string;
  status: (typeof CAMPAIGN_STATUS)[number];
  version: number;
  createdAt: number;
  updatedAt: number;
  // True while the saved content came from an AI draft that Leo has not edited yet.
  aiDraft: boolean;
  config: CampaignInput;
};

export const emptyCampaign = (): CampaignInput => ({
  name: '',
  platform: 'tiktok',
  product: {
    name: '',
    url: '',
    priceIdr: null,
    benefits: '',
    targetBuyer: '',
    notes: '',
  },
  affiliateLink: '',
  studio: studioSchema.parse({}),
  content: {
    hooks: [],
    script: '',
    storyboard: [],
    caption: '',
    hashtags: [],
    cta: '',
  },
});

// What the AI is asked to return for each kind, checked before anything is kept.
export const aiResultSchema = {
  script: z.object({
    hooks: z.array(z.string().max(300)).max(10),
    script: z.string().max(4000),
    cta: z.string().max(300),
  }),
  caption: z.object({
    caption: z.string().max(2200),
    hashtags: z.array(z.string().regex(/^#?[\p{L}\p{N}_]{1,50}$/u)).max(30),
  }),
  storyboard: z.object({ storyboard: z.array(sceneSchema).min(1).max(20) }),
};

// Merges an AI result into the content as a draft; nothing else in the campaign is touched.
export function applyDraft(
  content: CampaignInput['content'],
  kind: GenerateKind,
  result: unknown,
): CampaignInput['content'] {
  const parsed = aiResultSchema[kind].parse(result);
  return { ...content, ...parsed };
}
