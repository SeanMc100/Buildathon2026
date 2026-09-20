# Job sources

`npm run ingest:jobs` builds `data/jobs.json` from four sources and writes 216
items: 198 Detroit occupations and 18 standing apprenticeships/internships.

What this catalog holds is **occupations, not postings**. "Machinists — metro
Detroit, 7,680 jobs, middle half earn $48k–$65k, apprenticeship is a normal way
in" stays true next month. "Machinist II at Acme, posted 3 days ago" does not.

## Working sources

| Source | How it is read | Key? | Contributes |
|---|---|---|---|
| **O*NET 31.0** | Bulk CSV tables from `onetcenter.org/dl_files/database/db_31_0_csv/` | No | Every match tag: Holland code, job zone, education, work context, activities. 198 items. |
| **BLS OEWS May 2025** | `oesm25ma.zip` → `MSA_M2025_dl.xlsx`, filtered to MSA 19820 | No | Detroit wage percentiles, local employment, location quotient. 215 of 216 items. |
| **Projections Central** | `public.projectionscentral.org/Projections/LongTermRestJson/26`, paged | No | Michigan 2024–2034 growth and annual openings. 199 items. |
| **Entry routes** | `scripts/jobs/entry-routes.ts`, hand-checked sponsor pages, every url re-checked each run | No | 18 apprenticeships and internships. |
| CareerOneStop | Optional, off unless `CAREERONESTOP_USER_ID` + `CAREERONESTOP_TOKEN` are set | Yes (free) | Registered apprenticeship sponsors. **Never run — mapping unverified.** |

Downloads land in `.cache/` (gitignored) and are reused for 120 days, so a
re-run on the same day does no network work and produces identical ids.
`download.bls.gov` rejects generic user agents, so every request sends a
descriptive one with a contact, exactly as the events ingest does.

## How the tags are made

Nearly every tag is a rescaling of a measured O*NET number rather than a
keyword guess — that is the point of using the bulk database.

- **hollandCode** — O*NET's own ranked interest high-points.
- **jobZone / minEducation** — `job_zones.csv`; education is the lowest of the
  12 O*NET categories that at least 25% of incumbents reported (the floor a
  person can actually enter at, not the modal credential).
- **traits** — composites of Work Context and Work Activities ratings. Read
  `chooseTraits` in `enrich.ts`; every line says which element it uses.
- **demands** — measured for `physical_work`, `managing_people`,
  `sales_targets`, `high_stakes`. **Approximated** for the other three, because
  O*NET does not ask the question:
  - `night_shifts` — a curated list of SOC families that run around the clock.
    A permanent night shift is a *regular* schedule in O*NET's terms, so its
    schedule field cannot see it. This is the most over-inclusive tag (108 of
    216 items) and the first one to argue with.
  - `on_call` — a curated SOC list plus irregular hours + a long week +
    responsibility for someone's safety.
  - `heavy_travel` — time in a vehicle, or selling outside the company.
- **arrangement** — `Onsite`, or `Hybrid` for desk-and-computer work. Never
  `Remote`: no source here knows what a given Detroit employer allows.
- **hiringHere** — hand-written per sector in `sectors.ts`. The only editorial
  field in the pipeline. Marked `provenance.hiringHere: 'curated-by-sector'`.

Every item carries `detroit.provenance` saying where its wages, tags and
outlook came from, so nothing reads as more certain than it is.

## Which occupations make the cut

`select.ts`. BLS lists ~700 detailed occupations for the metro; all 700 would
drown the app and the top 150 by pay would be doctors and executives. So the
cut is per sector, with a quota each (`SECTOR_QUOTAS`), ranked inside a sector
by blended local demand (employment 55%, statewide annual openings 30%,
location quotient 15%). Two guardrails: a floor of 45 job-zone-1-and-2
occupations so a first-jobber never meets a wall of degrees, and a minimum of
300 local jobs so nothing listed is a Detroit rarity.

## Not covered, and why

- **LinkedIn, Indeed, Glassdoor, ZipRecruiter** — terms restrict automated
  reads, and postings expire, which is the wrong shape for this catalog.
- **apprenticeship.gov sponsor list** — served through a Tableau embed; not
  fetchable. Its job finder runs on CareerOneStop, which needs a key.
- **Michigan LMI / milmi.org "Hot 50"** — published as PDF only. Projections
  Central carries the same underlying projections as JSON, so we use that.
- **Detroit at Work, Michigan Works!** — front doors worth linking from the app
  (`detroitatwork.com/training`, `michiganworks.org/apprenticeships`) but they
  list programmes, not occupations, so they belong to the programs slice.
- **BLS API v2 and O*NET Web Services** — both need keys and neither adds
  anything the bulk files do not already have.

## Adding a source

Add a `JobSource<T>` to `sources.ts` and wire it into the `Promise.all` in
`ingest.ts`. Every source runs inside `run()`, so one failing is reported as an
error row and skipped; it never takes the run down. If BLS is the one that
fails, the run degrades to a catalog with no wages rather than no catalog.

## What a human must check before launch

1. `hiringHere` in `sectors.ts` — hand-written, never verified against anything.
2. `entry-routes.ts` — 18 links all answer, but only a person can confirm each
   page still says what we claim. Several employer entries (Henry Ford,
   Corewell, DPSCD, Focus: HOPE) are typed `Apprenticeship` because they run
   earn-while-you-learn hiring; confirm the registration status of each.
3. The three approximated demands above.
4. Bump `ONET_RELEASE` and `OEWS_RELEASE` in `sources.ts` when new releases land.
