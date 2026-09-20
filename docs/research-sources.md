# Research opportunity sources

`npm run ingest:research` pulls research opportunities a person in metro Detroit
can apply to and writes `data/research.json`, which the app loads. It mirrors the
events pipeline: named source adapters, per-source error isolation, a region
filter, an enricher that fills the match tags, and a runner that writes a JSON
snapshot plus a per-source `fetched / kept` report.

Last real run: 50 items — 27 paid, 19 open to someone with no degree and nothing
to enrol in, 15 community-based.

## Why this is a registry and not a scraper

Universities and health systems do not publish research programmes as feeds.
There is no equivalent of the events pipeline's Tribe or `.ics` endpoints, and
three of the obvious routes are closed to robots:

| Route | What happens |
|---|---|
| NSF REU Site search (`nsf.gov/funding/initiatives/reu/search`) | AWS WAF answers `202` with an empty body and `x-amzn-waf-action: challenge`. Not evaded. |
| `umich.edu`, `emich.edu`, `detroitmi.gov` | Cloudflare returns `403` "Just a moment…". Not evaded. |
| Pathways to Science | Results render through ASP.NET postbacks; the plain URL returns only the search form. |

So `scripts/research/registry.ts` holds one hand-read entry per programme, and
the pipeline does the repeatable part: every run re-fetches each URL, classifies
it `ok` / `blocked` / `dead`, re-reads the numbers with `extract.ts` and reports
anything that no longer matches. Stale entries surface in the run report instead
of rotting quietly.

## Working sources

| Source | How it is read | Key | Items | Fragility |
|---|---|---|---|---|
| `registry` | 36 curated programme pages, re-fetched and re-checked each run | none | 36 | Medium — a university reorganising its site breaks one entry, and the run says which |
| `nsf-reu-sites` | NSF Awards API, `keyword="REU Site"&awardeeStateCode=MI`, filtered to live awards in metro cities | none | 9 | Low — stable federal JSON API |
| `nih-nrsa-fellowships` | Grants.gov Search2 POST, allowlisted to the NRSA "Parent" notices an individual really applies to | none | 5 | Low |
| `nsf-awards-coverage` | Same NSF API, audit only | none | 0 | Low |
| `nih-reporter-coverage` | NIH RePORTER POST, `org_states: [MI]` + Detroit-area cities, audit only | none | 0 | Low |

### Why two sources contribute nothing

An NSF or NIH award is money to an institution; nobody applies to one. The two
audits exist so a scheduled run can say *"Wayne State holds 164 live NIH projects
and we list eight ways in"*, and flag an institution with live funding and no
registry entry at all. The last run flagged the John D Dingell VA Medical Center
(15 live projects) and the Ann Arbor Veterans Health Administration (55) — we
have found no Detroit-specific VA research or training page, so they remain
uncovered on purpose.

The exception is an NSF **REU Site** award, which funds exactly the programme
undergraduates apply to. Those become items: the award record gives the
institution, the official title and, from the abstract, the length of the summer.
It never gives a stipend or a deadline, and those stay `null`.

## Accuracy rules

- `stipendUsd`, `durationWeeks`, `startsAt`, `applyBy`, `eligibility` and `field`
  come off the page. If the page does not say, the value is `null`. Of 50 items,
  only 4 carry a stipend and 8 a deadline, because only that many pages stated one.
- A deadline written without a year ("applications are due February 15") goes in
  `research.annualDeadline` as `MM-DD`, never in `applyBy`.
- `minEducation` is the floor to take part. A programme requiring current
  undergraduate enrolment is `secondary`, never `none_required`; the real
  constraint rides in `research.enrollmentRequired`.
- `research.factsFrom` records provenance per item: `program_page` (30),
  `api` (14), `unverified` (6 — the Cloudflare-blocked pages, emitted with real
  URLs and null facts rather than guesses).
- A dollar figure that is not pay is not recorded as pay. Karmanos PATH shows
  $3,000–$4,000 per fellow; that is a lab reagent budget, so `stipendUsd` is null
  and a curator note says why.

## Recurring programmes whose deadline has passed

Almost every research programme here is annual with a late-winter application
window. A passed deadline means the next cohort has not opened, not that the
programme is over. So `enrich.ts`:

- keeps the item, sets `research.deadlinePassed: true`, leaves `applyBy` as the
  real past date, and adds a drift note naming the recurrence;
- drops it only when `recurrence` is `one_time` or `unknown` — the two cases
  where a passed deadline really is the end.

The app can then show it as "opens again" rather than hiding it. The last run
kept 2 such items (Wayne State SURF, Oakland UnCoRe-CyberAI).

A page that returns 404 is dropped, because there is nowhere to apply. A host
that merely refuses robots (`blocked`) is kept — the page is still there for
anyone with a browser — and listed in the run report.

## Extra fields

Items are `ResearchOpportunity & { research: {...} }`. The `research` block holds
everything the shared model has no room for; Sean promotes it into
`src/models/opportunity.ts` and `docs/schema.json`. See
`scripts/research/types.ts` for the exact definitions.

## Ethics

Public APIs and public pages only. A descriptive User-Agent, a 25-second timeout
and an 800 ms gap between requests to the same host (`scripts/research/http.ts`).
Nothing logs in, solves a challenge or pretends to be a browser. No LinkedIn, no
Facebook. Individual job postings are not scraped — they churn in weeks, so the
registry links the employer's stable student-internship board instead.

## Adding a source

Add an entry to `SOURCES` in `scripts/research/sources.ts` (a `ResearchSource`
is a name, an endpoint and a `fetch()` returning `RawResearch[]`), or — far more
often — add one entry to `REGISTRY` in `scripts/research/registry.ts` following
the house rules in that file's header.

## Known gaps, to verify before demo

- **6 U-M / EMU entries** (`factsFrom: 'unverified'`): SROP, LSA UROP, MICHR, SPH
  Summer Enrichment, U-M Detroit Center, EMU Undergraduate Research. Real URLs,
  no facts read. Someone with a browser should fill in stipend, dates, deadline.
- **9 NSF REU sites** link to the NSF award page, not an application page. The
  host department's own page still needs finding by hand for each.
- **Wayne State Summer Research Program (SRP)** — the page still describes the
  2022 cohort and says nominations are closed. Confirm it still runs.
- **Oakland AERIM** has skipped at least one summer; check before promoting it.
- **VA Detroit / Ann Arbor** — live NIH funding, no route found. Needs a human.
- Hub pages (Henry Ford research, Corewell student internships, LTU research,
  WSU Center for Urban Studies, Karmanos training index) are stable front doors,
  not single openings; requirements differ per role behind them.
