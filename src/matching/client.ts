// Posts a profile to the opportunity-matching endpoint. Matching slice.
//
// The endpoint URL comes from app config (expo.extra.matchingEndpoint), so the
// flow is fully usable before anyone has stood a server up: with no URL
// configured we return the payload we would have sent, which is what the
// results screen shows.

import Constants from 'expo-constants';

import type { CareerProfile, MatchRequest, MatchResponse } from '../models';
import { buildMatchRequest } from './payload';

export type MatchOutcome =
  | { status: 'sent'; request: MatchRequest; response: MatchResponse }
  | { status: 'not_configured'; request: MatchRequest }
  | { status: 'error'; request: MatchRequest; message: string };

function endpointUrl(): string | null {
  const extra = Constants.expoConfig?.extra as { matchingEndpoint?: string } | undefined;
  const url = extra?.matchingEndpoint;
  return typeof url === 'string' && url.length > 0 ? url : null;
}

export async function submitProfile(
  profile: CareerProfile,
  options: { timeoutMs?: number } = {},
): Promise<MatchOutcome> {
  const request = buildMatchRequest(profile);
  const url = endpointUrl();
  if (!url) return { status: 'not_configured', request };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 20000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { status: 'error', request, message: `Matching service returned ${response.status}.` };
    }

    const body = (await response.json()) as MatchResponse;
    return { status: 'sent', request, response: body };
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'Matching service timed out.'
        : 'Could not reach the matching service.';
    return { status: 'error', request, message };
  } finally {
    clearTimeout(timer);
  }
}
