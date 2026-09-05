export const FEEDBACK_CATEGORIES = ['bug', 'suggestion', 'usability', 'other'] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: 'Bug',
  suggestion: 'Suggestion',
  usability: 'Usability',
  other: 'Other',
};

export type FeedbackPayload = {
  category: FeedbackCategory;
  summary: string;
  details: string;
  pagePath: string | null;
};

export type FeedbackValidationResult =
  | { ok: true; value: FeedbackPayload }
  | { ok: false; error: string };

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function safePagePath(value: unknown): string | null {
  const path = cleanText(value);
  if (!path) return null;
  if (path.length > 500 || !path.startsWith('/') || path.startsWith('//')) return null;
  return path;
}

export function validateFeedbackPayload(input: unknown): FeedbackValidationResult {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Feedback details are required.' };
  }

  const body = input as Record<string, unknown>;
  const category = cleanText(body.category) as FeedbackCategory;
  const summary = cleanText(body.summary);
  const details = cleanText(body.details);
  const rawPagePath = cleanText(body.pagePath);

  if (!FEEDBACK_CATEGORIES.includes(category)) {
    return { ok: false, error: 'Choose a feedback category.' };
  }
  if (summary.length < 3 || summary.length > 120) {
    return { ok: false, error: 'Summary must be between 3 and 120 characters.' };
  }
  if (details.length < 3 || details.length > 5000) {
    return { ok: false, error: 'Details must be between 3 and 5,000 characters.' };
  }
  if (rawPagePath && !safePagePath(rawPagePath)) {
    return { ok: false, error: 'The page context is invalid.' };
  }

  return {
    ok: true,
    value: {
      category,
      summary,
      details,
      pagePath: safePagePath(rawPagePath),
    },
  };
}
