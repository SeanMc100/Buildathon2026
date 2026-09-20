// Pure checks for what members type into the board. No React, no storage.

import type { BoardPostInput } from '../models';

export const LIMITS = {
  message: 500,
  title: 80,
  organization: 60,
  url: 300,
  details: 600,
} as const;

/**
 * Accepts "example.org/jobs" or "https://example.org/jobs" and returns an
 * http(s) URL, or null when it is not one. Anything else (javascript:, tel:,
 * file:) is refused, because the link is opened straight from the board.
 */
export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export type PostDraft = {
  kind: BoardPostInput['kind'] | null;
  title: string;
  organization: string;
  city: string | null;
  url: string;
  details: string;
};

export type PostErrors = Partial<Record<'kind' | 'title' | 'organization' | 'city' | 'url' | 'details', string>>;

export function validatePost(draft: PostDraft): { errors: PostErrors; input: BoardPostInput | null } {
  const errors: PostErrors = {};
  const title = draft.title.trim();
  const organization = draft.organization.trim();
  const details = draft.details.trim();
  const url = draft.url.trim() ? normalizeUrl(draft.url) : null;

  if (!draft.kind) errors.kind = 'Pick what kind of opportunity this is.';
  if (!title) errors.title = 'Add a title.';
  if (!organization) errors.organization = 'Add who is offering it.';
  if (!draft.city) errors.city = 'Pick where it is.';
  if (draft.url.trim() && !url) errors.url = 'Enter a web link like example.org/jobs, or leave it blank.';
  if (!details) errors.details = 'Add a sentence or two so people know what it is.';

  if (Object.keys(errors).length > 0 || !draft.kind || !draft.city) {
    return { errors, input: null };
  }
  return { errors, input: { kind: draft.kind, title, organization, city: draft.city, url, details } };
}
