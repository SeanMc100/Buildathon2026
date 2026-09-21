# Ingestion

Four scripts collect what the app matches against. Each writes one snapshot
file; `src/content/catalog.ts` reads all four.

| Kind | Command | Writes | Items now | Sources doc |
|---|---|---|---|---|
| Events | `npm run ingest:events` | `data/events.json` | 73 | [event-sources.md](event-sources.md) |
| Jobs | `npm run ingest:jobs` | `data/jobs.json` | 120 | [job-sources.md](job-sources.md) |
| Programs | `npm run ingest:programs` | `data/programs.json` | 88 | [program-sources.md](program-sources.md) |
| Research | `npm run ingest:research` | `data/research.json` | 50 | [research-sources.md](research-sources.md) |

`npm run ingest:all` runs all four. `npm run verify:catalog` then ranks three
test personas across every kind, which is the fastest way to see that a pull
actually reached the matcher.

## What "job" means here

`data/jobs.json` holds **occupation types, not job postings**: what a kind of
work pays in metro Detroit, what it takes to get in, and who hires for it.
Postings go stale in days and most boards forbid automated reads. Occupations
do not go stale, so a monthly pull is enough.

## Scheduling

The scripts are idempotent and safe to re-run: stable ids, per-source error
isolation, and large downloads cached in `.cache/`. A run rewrites its snapshot
file wholesale, so a scheduled pull is `npm run ingest:all` followed by a commit
of `data/`.

Sensible cadences, given how fast each source actually changes:

| Kind | Cadence | Why |
|---|---|---|
| Events | Weekly, or before a demo | Events expire. A stale snapshot empties the row. |
| Programs | Monthly | Cohorts and pages shift slowly; the run reports drift. |
| Research | Monthly, plus every September | Most programmes open applications in the autumn. |
| Jobs | Twice a year | BLS wages are annual; O*NET ships about twice a year. |

Nothing here needs an API key. `scripts/jobs/` has an unexecuted CareerOneStop
adapter that switches on if `CAREERONESTOP_USER_ID` and `CAREERONESTOP_TOKEN`
are set; it is the one key worth registering for, because it would replace most
of the hand-typed entry routes with live apprenticeship records.

## Reading a snapshot honestly

Every snapshot reports per-source `fetched / kept` counts, and a failing source
never blocks the others — so **a run that "succeeded" can still have lost a
source**. Read the report, not just the exit code.

The three new kinds mix three grades of certainty, and each item says which it
is rather than leaving you to guess:

- **Measured.** O*NET instrument scores and BLS wage percentiles. A job's
  `hollandCode`, `jobZone`, `minEducation` and most `traits` come from the
  instrument itself, not from the keyword pass the event pipeline has to use.
- **Read off a page.** Programme costs, credentials, deadlines. Recorded only
  when the page stated them, which is why most programme durations and dates are
  `null`. A looser parser produced wrong numbers, not more of them.
- **Curated.** A job's `hiringHere` list and the research registry's summaries.
  No source publishes these. `provenance` / `factsFrom` marks them, and the UI
  should not present them with the same confidence as the first two.

Known soft spots, worth fixing before this is load-bearing:

- `night_shifts` fires on 46 of 102 occupations. O*NET cannot measure it (a
  permanent night shift reads as a *regular* schedule), so it is a SOC-family
  heuristic and it over-fires. Because `demands` is checked against user
  dealbreakers, this wrongly filters roles out for anyone excluding nights.
- Six research items are `factsFrom: 'unverified'` — U-M and EMU sit behind
  Cloudflare. The URLs are real; every fact was left null rather than guessed.

## Adding a source

Each pipeline takes one line per source, in its own `sources.ts` or
`registry.ts`. The per-kind docs above spell out the adapter signatures. Where
an organisation runs WordPress, try `<site>/wp-json/wp/v2/pages` before
scraping HTML — seven of the nine programme sources turned out to expose it,
and it is far steadier.

Public APIs, published data files and public pages only. Nothing logs in, and
nothing touches Facebook, Eventbrite, LinkedIn or Indeed, whose terms restrict
automated reads.
