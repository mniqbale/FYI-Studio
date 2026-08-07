// Content Brief — a first-class Business Artifact (PRODUCT_CONSTITUTION §5).
//
// This module makes the ubiquitous language "Content Brief" concrete as a typed
// artifact that flows through the pipeline: Founder/Operator creates a Brief,
// and Research/Script/Media/Publishing consume it as the primary input.
//
// Per the Phase 2 discipline, this defines ONLY the artifact (vocabulary) —
// no lifecycle, state machine, or ownership. Those emerge later if/when
// implementation requires them.

/** The Content Brief: contract for ONE piece of content. */
export interface ContentBrief {
  /** Stable identifier for this brief. */
  brief_id: string;
  /** Business objective of the content (e.g. educate, brand, revenue, retention). */
  objective: string;
  /** Target audience segment / persona. */
  audience: string;
  /** The concrete topic. */
  topic: string;
  /** Angle / hook / point of view. */
  angle: string;
  /** How success will be measured (views, retention, CTR, revenue). */
  success_metric: string;
  /** Brand voice, forbidden terms, duration, and other constraints. */
  constraints: Record<string, unknown>;
  /** Where and how the content will be distributed. */
  distribution_target: string;
}

/** Required fields for a valid Content Brief (others may be empty). */
const REQUIRED_FIELDS: Array<keyof ContentBrief> = [
  'brief_id',
  'objective',
  'audience',
  'topic',
  'angle',
  'success_metric',
  'distribution_target',
];

/** A parsed brief may have an `_origin` to record the source (e.g. manual). */
export interface ParsedContentBrief extends ContentBrief {
  _origin?: string;
}

/**
 * Validate an unknown value as a Content Brief. Returns the validated brief on
 * success, or null when required fields are missing. Non-null fields that are
 * missing default to '' (empty string) so consumers can fall back gracefully.
 */
export function parseContentBrief(value: unknown): ParsedContentBrief | null {
  if (!value || typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;

  const brief: ParsedContentBrief = {
    brief_id: typeof rec.brief_id === 'string' ? rec.brief_id : '',
    objective: typeof rec.objective === 'string' ? rec.objective : '',
    audience: typeof rec.audience === 'string' ? rec.audience : '',
    topic: typeof rec.topic === 'string' ? rec.topic : '',
    angle: typeof rec.angle === 'string' ? rec.angle : '',
    success_metric: typeof rec.success_metric === 'string' ? rec.success_metric : '',
    constraints:
      rec.constraints && typeof rec.constraints === 'object'
        ? (rec.constraints as Record<string, unknown>)
        : {},
    distribution_target: typeof rec.distribution_target === 'string' ? rec.distribution_target : '',
  };

  if (typeof rec._origin === 'string') brief._origin = rec._origin;

  const missing = REQUIRED_FIELDS.filter((f) => !brief[f]);
  if (missing.length > 0) return null;
  return brief;
}

/** Render a Content Brief as a compact human/machine-readable summary. */
export function briefToPrompt(brief: ContentBrief): string {
  const lines = [
    `Topic: ${brief.topic}`,
    `Objective: ${brief.objective}`,
    `Audience: ${brief.audience}`,
    `Angle: ${brief.angle}`,
    `Success metric: ${brief.success_metric}`,
    `Distribution: ${brief.distribution_target}`,
  ];
  if (brief.constraints && Object.keys(brief.constraints).length > 0) {
    lines.push(`Constraints: ${JSON.stringify(brief.constraints)}`);
  }
  return lines.join('\n');
}
