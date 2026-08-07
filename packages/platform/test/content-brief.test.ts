// Unit tests for the Content Brief Business Artifact (PRODUCT_CONSTITUTION §5).
// Phase 2.1: verifies the brief parses/validates as the shared vocabulary and
// renders to a prompt for Research/Script.
import { describe, it, expect } from 'vitest';
import { parseContentBrief, briefToPrompt, parseContentInitiative, initiativeToPrompt } from '../src/content-brief.js';

const validBrief = {
  brief_id: 'brief-001',
  objective: 'educate',
  audience: 'solo creators',
  topic: 'AI orchestration for media',
  angle: 'practical, beginner-friendly',
  success_metric: 'retention > 60%',
  constraints: { max_duration_sec: 240, forbidden_terms: ['miracle'] },
  distribution_target: 'YouTube Shorts',
};

describe('ContentBrief (Phase 2.1 artifact)', () => {
  it('parses a valid brief', () => {
    const brief = parseContentBrief(validBrief);
    expect(brief).not.toBeNull();
    expect(brief!.topic).toBe('AI orchestration for media');
    expect(brief!.objective).toBe('educate');
  });

  it('rejects null/non-object input', () => {
    expect(parseContentBrief(null)).toBeNull();
    expect(parseContentBrief('hello')).toBeNull();
    expect(parseContentBrief(42)).toBeNull();
  });

  it('rejects a brief missing a required field', () => {
    const { success_metric: _drop, ...partial } = validBrief;
    expect(parseContentBrief(partial)).toBeNull();
  });

  it('defaults optional-missing fields and carries _origin', () => {
    const brief = parseContentBrief({ ...validBrief, _origin: 'manual' });
    expect(brief!._origin).toBe('manual');
  });

  it('renders to a prompt with key fields', () => {
    const prompt = briefToPrompt(validBrief);
    expect(prompt).toContain('Topic: AI orchestration for media');
    expect(prompt).toContain('Objective: educate');
    expect(prompt).toContain('Success metric: retention > 60%');
    expect(prompt).toContain('Constraints:');
  });
});

const validInitiative = {
  initiative_id: 'init-001',
  objective: 'grow subscribers by educating solo creators',
  audience: 'solo content creators',
  topic_area: 'AI orchestration for media',
  constraints: { language: 'en' },
};

describe('ContentInitiative (Phase 2.2 input)', () => {
  it('parses a valid initiative', () => {
    const ini = parseContentInitiative(validInitiative);
    expect(ini).not.toBeNull();
    expect(ini!.objective).toBe('grow subscribers by educating solo creators');
  });

  it('rejects null/non-object', () => {
    expect(parseContentInitiative(null)).toBeNull();
    expect(parseContentInitiative('x')).toBeNull();
  });

  it('rejects an initiative missing a required field', () => {
    const { topic_area: _drop, ...partial } = validInitiative;
    expect(parseContentInitiative(partial)).toBeNull();
  });

  it('renders to a prompt', () => {
    const prompt = initiativeToPrompt(validInitiative);
    expect(prompt).toContain('Topic area: AI orchestration for media');
    expect(prompt).toContain('Objective: grow subscribers');
  });
});
