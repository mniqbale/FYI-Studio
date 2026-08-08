// Phase 2.3 — Channel-aware Production Pipeline v1 (AC-1).
//
// Defines two Business Units (Channels) with full DNA (9 dimensions from
// CHANNEL_CONSTITUTION) stored in the existing `tenant_context` table.
// No schema change — DNA lives in the flexible `constraints` Json column.
//
//   Just FYI Facts  -> netral, edukatif
//   Just FYI Sports -> cepat, hype, momentum
//
// Usage: pnpm tsx services/dashboard/scripts/seed-business-units.ts
import { prisma } from '../src/utils/prisma.js';
import { loadEnv } from '../src/utils/env.js';

loadEnv();

/** Full DNA of a Business Unit (CHANNEL_CONSTITUTION §4). */
interface BusinessUnitDna {
  identity: { name: string; positioning: string; mission: string };
  audience: string;
  content_pillars: string[];
  brand_voice: string;
  visual_identity: { style: string; palette: string };
  production_preferences: { format: 'vertical' | 'horizontal'; resolution: string; duration: string; duration_seconds: number };
  publishing_strategy: { platforms: string[]; cadence: string };
  success_metrics: string[];
  guardrails: string[];
}

const BUSINESS_UNITS: Record<string, BusinessUnitDna> = {
  'bu-just-fyi-facts': {
    identity: {
      name: 'Just FYI Facts',
      positioning: 'A calm, trustworthy explainer channel for curious minds.',
      mission: 'Make complex topics simple, accurate, and worth sharing.',
    },
    audience: 'Curious general audience who want clear, unbiased explanations.',
    content_pillars: ['science', 'history', 'how-things-work', 'myths-debunked'],
    brand_voice: 'Neutral, educational, measured. Prefer plain language and balanced framing.',
    visual_identity: { style: 'clean, minimal, muted tones', palette: 'soft blue / white / gray' },
    production_preferences: { format: 'horizontal', resolution: '1920x1080', duration: '8-12 min', duration_seconds: 600 },
    publishing_strategy: { platforms: ['youtube'], cadence: 'weekly' },
    success_metrics: ['watch_time', 'retention', 'subscriber_growth'],
    guardrails: ['no hype', 'no clickbait', 'no unverified claims'],
  },
  'bu-just-fyi-sports': {
    identity: {
      name: 'Just FYI Sports',
      positioning: 'A fast, energetic sports channel for fans who want the moment.',
      mission: 'Deliver the latest sports stories with speed and excitement.',
    },
    audience: 'Sports fans who want quick, hype-driven updates and highlights.',
    content_pillars: ['match-recap', 'transfer-news', 'player-stories', 'momentum'],
    brand_voice: 'Fast, energetic, hype. Short punchy sentences, strong verbs, momentum.',
    visual_identity: { style: 'bold, high-contrast, dynamic', palette: 'black / neon green / white' },
    production_preferences: { format: 'vertical', resolution: '1080x1920', duration: '1-3 min', duration_seconds: 120 },
    publishing_strategy: { platforms: ['youtube', 'tiktok'], cadence: 'daily' },
    success_metrics: ['views', 'shares', 'ctr'],
    guardrails: ['no slow intros', 'no long pauses', 'no dry analysis'],
  },
};

async function main(): Promise<void> {
  for (const [tenantId, dna] of Object.entries(BUSINESS_UNITS)) {
    await prisma.tenantContext.upsert({
      where: { tenant_id: tenantId },
      update: {
        brand_voice: dna.brand_voice,
        language: 'en',
        style_guide: dna.visual_identity.style,
        // Full DNA in the flexible constraints column (raw object, no stringify).
        constraints: {
          identity: dna.identity,
          audience: dna.audience,
          content_pillars: dna.content_pillars,
          visual_identity: dna.visual_identity,
          production_preferences: dna.production_preferences,
          publishing_strategy: dna.publishing_strategy,
          success_metrics: dna.success_metrics,
          guardrails: dna.guardrails,
        } as object,
      },
      create: {
        tenant_id: tenantId,
        brand_voice: dna.brand_voice,
        language: 'en',
        style_guide: dna.visual_identity.style,
        constraints: {
          identity: dna.identity,
          audience: dna.audience,
          content_pillars: dna.content_pillars,
          visual_identity: dna.visual_identity,
          production_preferences: dna.production_preferences,
          publishing_strategy: dna.publishing_strategy,
          success_metrics: dna.success_metrics,
          guardrails: dna.guardrails,
        } as object,
      },
    });
    console.log(`✅ Business Unit seeded: ${dna.identity.name} (${tenantId})`);

    // AC-1: ensure each Channel has an enabled social account matching its
    // publishing_strategy so the target is resolvable. Dry-run token (mock).
    for (const platform of dna.publishing_strategy.platforms) {
      const existing = await prisma.socialAccount.findFirst({
        where: { tenant_id: tenantId, platform },
      });
      if (!existing) {
        await prisma.socialAccount.create({
          data: {
            tenant_id: tenantId,
            platform,
            display_name: `${dna.identity.name} (${platform})`,
            account_ref: `UC-${tenantId}-${platform}`,
            token_ref: 'dry-run-mock-token',
            enabled: true,
          },
        });
        console.log(`   ✅ Social account seeded: ${platform} for ${tenantId}`);
      }
    }
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
