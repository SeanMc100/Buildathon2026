# Why the intake asks what it asks

Three research passes fed this design: what actually predicts job satisfaction,
which taxonomies exist for describing people and work, and how to build a mobile
questionnaire whose output an LLM can use. The decisions below are the ones that
changed the build. Full briefs are summarised here; sources are linked inline.

## What we measure, and why

Ranked by evidence strength, the constructs worth a question each:

1. **Person-job fit** — the strongest single predictor in the literature
   (r = .56 with satisfaction, r = -.46 with intent to quit, across 172 studies).
   [Kristof-Brown et al. 2005](https://onlinelibrary.wiley.com/doi/10.1111/j.1744-6570.2005.00672.x)
2. **Autonomy** — the most consistent individual driver, in both the Job
   Characteristics Model and Self-Determination Theory. Asked directly
   (`autonomy`).
3. **Manager quality and relatedness** — outrank pay in facet-level studies;
   interpersonal stress is the top predictor of turnover intent. Asked as
   `manager_support` and `team_shape`.
4. **Meaning and growth** — carried by the budget question rather than their own
   Likert items, because everyone rates them "important" in isolation.
5. **Demand type, not demand level** — challenge demands raise engagement,
   hindrance demands lower it. Same hours, opposite outcome, so
   `deadline_response` asks which one the person means.
   [Crawford, LePine & Rich 2010](https://pubmed.ncbi.nlm.nih.gov/20836586/)
6. **Pay as stress relief, not maximisation** — pay level correlates only r = .15
   with job satisfaction. `pay_stance` asks about the floor, not the ceiling.
   [Judge et al. 2010](https://www.sciencedirect.com/science/article/abs/pii/S0001879110000722)

Deliberately cut: separate skill-variety and task-identity items (merged into
`variety_vs_depth`), separate person-organisation / person-group / person-
supervisor fit scales (they overlap heavily with person-job fit), full O*NET or
Schwartz values batteries, and fringe-benefit detail.

## Format choices

- **14 required items, one per screen.** Completion is flat below ~15 questions
  and falls sharply past it. Optional and branching items push a typical path to
  ~17 screens, two of which are one-tap skips.
- **Never a grid.** Matrix questions are the worst-performing mobile format.
- **Every scale point is labelled.** Fully-labelled scales are measurably more
  reliable than endpoint-only ones.
- **One budget-allocation question does the ranking work.** Likert importance
  items let people mark everything 5/5, which carries no information about what
  they would trade. Spending a fixed 100 points forces the trade-off, and it is
  the single biggest input to the profile.
- **Formats vary on purpose** — choice, scale, budget, multi-select — so nobody
  can autopilot down a column of identical rows.

## Where the taxonomies come from

- **Interests** use Holland's RIASEC dimensions, but from one question rather
  than the 60-item Interest Profiler. The profile marks this at 0.45 confidence
  and the system prompt tells the model it is a hint, not a measured code.
- **Job Zone** (1–5, O*NET's preparation-level scale) is derived from education
  plus experience, never asked.
- **Work values** are O*NET's six, inferred from answers we already have rather
  than asked. Cheap personalisation, explicitly low confidence.
- O*NET content is CC BY 4.0; the attribution line is in `src/content/copy.ts`
  and rendered at the bottom of the profile screen.

## Payload design

`src/matching/payload.ts` builds a hybrid request: structured JSON for anything
that has to be filtered or checked, plus one narrative sentence for the model to
reason against holistically.

- `hardConstraints` and `softPreferences` are structurally separate so a match
  can be eliminated before it is ever ranked.
- Every inferred field carries `confidence` and `source_question_ids`. Nothing
  reaches the model that cannot be traced to something the user actually said.
- `responseContract` requires the model to cite those ids back, explain
  trade-offs, and flag unmet constraints rather than quietly relaxing them.
- `excludedAttributes` is sent deliberately: it tells the model what it does not
  have and must not infer.

## What we never ask

Race, sex/gender/orientation, religion, national origin or immigration status,
age or date of birth, disability or health, genetic or family medical history,
pregnancy/marital/family status, salary history, criminal history, and home
address or postcode.

These are protected characteristics under US Title VII, the ADA, the ADEA and
GINA; the EEOC has confirmed that algorithmic tools carry disparate-impact
liability without any intent to discriminate. Employment-related AI is also
Annex III high-risk under the EU AI Act, which brings risk management, logging,
human oversight and bias testing obligations from August 2026.
[EEOC AI guidance](https://www.eeoc.gov/sites/default/files/2024-04/20240429_What%20is%20the%20EEOCs%20role%20in%20AI.pdf) ·
[EU AI Act Annex III](https://artificialintelligenceact.eu/annex/3/)

Two consequences for the build: proxy fields (postcode, school name) must not
become ranking inputs, and the provenance logging above is what makes a periodic
disparate-impact audit possible at all. Commute distance is stored as a distance
filter only.
