// Builds the request body for the opportunity-matching model. Matching slice.
//
// Shape choices, and why:
//  - Hybrid, not pure JSON and not pure prose. Structured fields for anything
//    that has to be filtered or checked, plus one narrative line for the model
//    to reason against holistically.
//  - hardConstraints and softPreferences are separate branches so a match can
//    be eliminated before it is ever ranked.
//  - Every inferred field carries confidence and the question ids behind it, so
//    the model can be told to cite them and we can audit what drove a result.
//  - excludedAttributes is sent deliberately: it tells the model what it does
//    not have and must not infer.

import { EXCLUDED_ATTRIBUTES } from '../content';
import type { CareerProfile, MatchRequest } from '../models';

export const MATCH_SCHEMA_VERSION = '1.0.0';

export function buildMatchRequest(profile: CareerProfile): MatchRequest {
  const style = profile.workStyle;

  return {
    schemaVersion: MATCH_SCHEMA_VERSION,
    profileId: profile.profileId,
    generatedAt: profile.generatedAt,
    narrativeSummary: profile.narrativeSummary,
    candidateContext: {
      careerStage: profile.stage.value,
      experienceBand: profile.experienceBand,
      educationLevel: profile.educationLevel,
      jobZone: profile.jobZone.value,
      focusArea: profile.focusArea,
    },
    hardConstraints: profile.hardConstraints,
    softPreferences: profile.priorities.map((item) => ({
      trait: item.trait,
      label: item.label,
      weight_0_100: item.weight,
      confidence: item.confidence,
      source_question_ids: item.sourceQuestionIds,
    })),
    workStyle: [
      {
        trait: 'autonomy_0_100',
        value: style.autonomy.value,
        confidence: style.autonomy.confidence,
        source_question_ids: style.autonomy.sourceQuestionIds,
      },
      {
        trait: 'variety_vs_depth_0_100',
        value: style.variety.value,
        confidence: style.variety.confidence,
        source_question_ids: style.variety.sourceQuestionIds,
      },
      {
        trait: 'preferred_pace',
        value: style.pace.value,
        confidence: style.pace.confidence,
        source_question_ids: style.pace.sourceQuestionIds,
      },
      {
        trait: 'challenge_vs_hindrance_appetite',
        value: style.challengeAppetite.value,
        confidence: style.challengeAppetite.confidence,
        source_question_ids: style.challengeAppetite.sourceQuestionIds,
      },
      {
        trait: 'team_shape',
        value: style.teamShape.value,
        confidence: style.teamShape.confidence,
        source_question_ids: style.teamShape.sourceQuestionIds,
      },
    ].filter((item) => item.source_question_ids.length > 0),
    interests: {
      holland_code: profile.interests.hollandCode,
      enjoys: profile.interests.enjoys,
      strengths: profile.interests.strengths,
      scores_0_100: profile.interests.scores,
      confidence: profile.interests.confidence,
      source_question_ids: profile.interests.sourceQuestionIds,
    },
    purpose: {
      themes: profile.causes.value,
      confidence: profile.causes.confidence,
      source_question_ids: profile.causes.sourceQuestionIds,
    },
    derivedWorkValues: {
      values: profile.workValues.value,
      confidence: profile.workValues.confidence,
      source_question_ids: profile.workValues.sourceQuestionIds,
    },
    freeText: profile.extraContext,
    responseContract: {
      max_recommendations: 5,
      must_cite_source_question_ids: true,
      must_explain_tradeoffs: true,
      must_flag_unmet_hard_constraints: true,
    },
    excludedAttributes: [...EXCLUDED_ATTRIBUTES],
  };
}

/**
 * The instruction that should sit in front of the payload on the server.
 * Kept here so the client and the endpoint cannot drift apart, and so the
 * contract is reviewable in the repo rather than buried in a prompt console.
 */
export const MATCH_SYSTEM_PROMPT = `You match people to work opportunities.

You receive one JSON profile built from a short questionnaire.

Rules:
1. Apply hardConstraints as filters first. Discard any opportunity that violates
   one. Never trade a hard constraint away for a better preference score.
2. Rank what survives using softPreferences. The weights are a budget the person
   actually spent, so treat a low weight as a real willingness to give that up.
3. Respect confidence. Anything below 0.5 is a hint, not a fact. The interests
   field in particular comes from two questions (what they enjoy, what they are
   good at) and is not a measured Holland code. Prefer roles where the two
   overlap. purpose.themes are the kinds of problem they want their work to
   serve, and candidateContext.focusArea is what they said they do or want to do.
4. Cite source_question_ids for every claim you make about the person.
5. Return at most responseContract.max_recommendations items. For each: title,
   one-paragraph summary, matchScore 0-100, whyItFits (2-3 short reasons, each
   citing a question id), gaps (what the person would have to accept), and
   citedQuestionIds.
6. If nothing clears the hard constraints, say so and list which constraint is
   doing the filtering rather than relaxing it yourself.
7. excludedAttributes lists things you were deliberately not given. Do not infer
   them, do not ask for them, and do not let them influence ranking.

Return JSON only, matching the MatchResponse shape.`;

/** Pretty-printed payload, for the results screen and for copy-to-clipboard. */
export function formatMatchRequest(request: MatchRequest): string {
  return JSON.stringify(request, null, 2);
}
