# Program sources

`npm run ingest:programs` pulls career development **programs** — things you enrol
in and keep attending — from the sources below and writes `data/programs.json`.
One-off events belong to `scripts/events`; open roles belong to `scripts/jobs`.

Every item is a `ProgramOpportunity` plus a `program` object holding the fields
the shared model has no room for yet (see **Extra fields** below).

## The shape of the problem

Almost no workforce-development organisation publishes a feed. Pretending one
exists produces a catalog that rots silently, so the design is deliberately two
halves:

1. **Automated fetchers** where real structure exists. Most Detroit workforce
   nonprofits run WordPress with the REST API left open, so
   `<site>/wp-json/wp/v2/pages` (or a custom post type) hands back every program
   page as JSON: title, link and body copy. Test this on any new organisation
   *before* writing a scraper.
2. **A curated registry** (`scripts/programs/registry.ts`) — one line per program
   page for everything else. It is not a pile of hand-typed facts: each run
   re-fetches the page, re-reads cost/length/dates/eligibility off it, and hashes
   the text so the next run can report what changed.

Both halves go through the same run, and the run tells you when it is drifting.

## What every run does

- **Isolates failures.** A source that throws is reported and skipped; the others
  finish. The report prints `fetched / kept` per source plus its fragility.
- **Checks every link.** All 88 URLs are fetched; anything that does not answer
  200 (or that bounces to a site's home page) is dropped and named. A demo that
  links to a 404 is worse than one entry short.
- **Diffs the previous snapshot.** `drift` in the output, and the console, list
  what is **new**, what has **gone**, whose page **changed** (sha1 of the page
  text) and whose **dates moved**.
- **Is idempotent.** Ids are `program-<source>-<sha1(source:sourceId)>` and items
  are sorted, so an unchanged re-run rewrites the same file.

## Working sources

| Source | How it is read | Items | Fragility |
|---|---|---|---|
| TechTown Detroit | WP REST `wp/v2/pages`, program pages under `/what-we-do/` | 8 | low |
| SER Metro-Detroit | WP REST custom type `program-service` | 7 | low |
| Focus: HOPE | WP REST `pages` under `/programs/job-training/` | 1 | low |
| Per Scholas Detroit | WP REST custom type `course`, filtered to Detroit | 3 | low |
| Build Institute | WP REST `pages`, the `build-*` courses | 5 | low |
| ProsperUS Detroit | WP REST `pages`, curated slug list | 4 | low |
| Goodwill Industries of Greater Detroit | WP REST `pages` under `/the-good-we-do/` | 7 | low |
| Detroit at Work | The training table on `detroitatwork.com/training` | 31 | high |
| Registry | `scripts/programs/registry.ts`, each page re-fetched | 22 | medium |

**Detroit at Work is the single most valuable source**: it is the list of training
the city currently buys with WIOA money, one row per provider and course, each
linking to that provider's own training bio. It covers CDL, carpentry, electrical,
solar, welding, CNC, nurse aide, medical assistant, pharmacy tech, dental assisting
and IT in one fetch. It is also an HTML table, so it is the most fragile adapter
here — if the markup changes the source returns nothing and the run says so.

> Note: that page also carries a block of cohort dates that is **commented out** of
> the published HTML. Unpublished content is not fact, so `html.ts` strips comments
> before reading. Do not "fix" this by reading them — the dates in there are stale.

## Adding a source

Add one line to `SOURCES` in `scripts/programs/sources.ts`:

- WordPress site: `wpSource(name, { base, collection, organization, city, location, keep })`.
  Check `<site>/wp-json/wp/v2/types` first to find custom post types.
- Anything else with a program page: add a `RegistryEntry` to `registry.ts`.

Set `mayBeEmpty: true` when returning nothing is normal.

## Accuracy rules

`scripts/programs/extract.ts` reads facts off the page and **returns null unless
the page states the thing plainly**. Every number must sit next to a word saying
what it is. Specifically:

- A duration needs a programme noun in the same sentence, refuses ranges
  ("between two and five months"), and returns `null` when a page states two
  different lengths (TechTown's Retail Boot Camp runs a 4-week and a 12-week
  edition off one page).
- A cost is `0` only when the page says free, a figure only when labelled, and
  never from a comparison ("any project that will cost over $600" is not tuition).
- A date must carry its own year, and a date already past becomes `null` with the
  page's wording kept in `program.scheduleNote`.

Anything a rule cannot read may be typed into a registry entry's `facts`. Those
fields are marked `registry` in `program.provenance` so they can be re-checked.

## Extra fields (for promotion into the shared model)

Emitted under `program` on every item, because `ProgramOpportunity` has no room
for them yet. Sean promotes these into `src/models/opportunity.ts` and
`docs/schema.json`; the types are in `scripts/programs/types.ts`.

| Field | Type | Meaning |
|---|---|---|
| `sector` | `ProgramSector` | Field of work: `skilled_trades \| healthcare \| manufacturing \| transport_logistics \| tech \| entrepreneurship \| creative \| adult_education \| general_workforce` |
| `audiences` | `ProgramAudience[]` | Who the provider says it is for: `youth \| young_adults \| returning_citizens \| women \| immigrants \| veterans \| older_workers \| detroit_residents \| low_income \| disability_support \| spanish_speakers`. Empty = open to adults generally |
| `delivery` | `'in_person' \| 'online' \| 'hybrid' \| 'unknown'` | Delivery format |
| `funding` | `FundingModel` | `free_to_participant \| wioa_funded \| employer_sponsored \| paid_training \| tuition \| scholarship_available \| unknown` |
| `credentials` | `string[]` | Certificates or licences named on the page (`CDL-A`, `CompTIA A+`, …) |
| `supports` | `('childcare' \| 'transport' \| 'stipend' \| 'tools_or_equipment' \| 'job_placement' \| 'housing' \| 'meals')[]` | Wraparound support offered |
| `applicationMethod` | `'online_form' \| 'phone' \| 'email' \| 'in_person' \| 'info_session' \| 'unknown'` | How you apply |
| `cadence` | `'rolling' \| 'cohort' \| 'continuous' \| 'annual' \| 'unknown'` | Cohort cadence |
| `scheduleNote` | `string \| null` | Schedule as the page words it, when no date could be parsed |
| `costNote` | `string \| null` | Cost as the page words it ("sliding scale"), when no figure could be read |
| `statewide` | `boolean` | Open beyond metro Detroit |
| `readAs` | `'wp_rest' \| 'html_table' \| 'html_page'` | How this item was read |
| `provenance` | `Record<'costUsd' \| 'durationWeeks' \| 'startsAt' \| 'applyBy' \| 'stipendUsd' \| 'eligibility', 'page' \| 'registry' \| 'absent'>` | Where each fact came from |
| `contentHash` | `string` | sha1 of the page text, for the drift report |
| `sourcePage` | `string` | Page the facts were read from, when not `url` |

## Not covered, and why

- **Eventbrite, Facebook, LinkedIn:** terms restrict automated reads.
- **Grand Circus** and **Center for Employment Opportunities:** both answer 403 to
  any non-browser request. Worth asking them for a feed, or entering by hand.
- **City Year Detroit:** its TLS chain does not validate under Node's fetch (it is
  fine in a browser). Left out rather than disabling certificate checks.
- **Michigan Works! Southeast:** the domain we tried does not resolve; find the
  current one before adding it.
- **apprenticeship.gov / Michigan ETPL:** no public JSON endpoint found that covers
  Michigan sponsors. Detroit at Work's table is the practical stand-in.

## What a human should check before a demo

- **Durations are almost all null** (1 of 88). The strict rule refuses ambiguity,
  which is honest but thin; the fastest improvement is typing confirmed lengths
  into registry `facts` for the programmes you plan to show.
- **Dates are almost all null** (1 `applyBy`). This is genuine: these providers
  publish "call us" rather than cohort dates. Do not invent any.
- **Detroit at Work rows** link to provider PDF bios. The PDFs are not parsed, so
  those 31 items carry the row's facts plus the page-level "free for Detroiters".
- Spot-check the five entries marked `fragility: 'high'` in `registry.ts`.
