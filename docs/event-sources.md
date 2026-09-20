# Event sources

`npm run ingest:events` pulls upcoming Detroit-area events from the sources below
and writes `data/events.json`, which the app loads. `npm run verify:events` runs
the real matcher against three test profiles.

Every event that has not ended is kept. Nothing is dropped for being off-topic;
non-career events are tagged neutrally so they rank last. What *is* dropped:
events outside metro Detroit (`scripts/events/region.ts`) and exact duplicates
across sources.

## Working sources

| Source | How it is read | Notes |
|---|---|---|
| TechTown Detroit | WordPress "The Events Calendar" REST API | Also carries the Build 313 Build Nights and the Venture 313 events. |
| Detroit Regional Chamber | Same API | Includes member-submitted events (career fairs, conferences). |
| Detroit Future City | Same API | Empty at the moment; kept so it fills in when they post. |
| Automation Alley | `events/feed.ics` | Manufacturing and industry events; many webinars. |
| Meetup: IT in the D, Detroit Women in Tech, Startup Detroit, Detroit New Tech | `meetup.com/<group>/events/ical/` | Every Meetup group has this feed. Add a group with one line. |
| Luma Detroit | The public city page's embedded data, plus each event page's description | Covers many hosts (Plug and Play, PitchMI, DSPL, ...). Less official than a feed; if Luma changes its page the adapter reports it and the run continues. |
| Manual | `data/manual-events.json` | For anything with no feed. See below. |

## Build 313

Build 313 (with TechTown, powered by Venture 313) runs weekly Tuesday build
nights, but as of Sep 19, 2026 there is no complete public schedule anywhere:

- `build313.ai/events` says "No events scheduled yet". The page loads its list
  from its own database, which is currently empty.
- The dates that do exist are in TechTown's calendar ("AI & Automation: Build
  Night 101" and "AI and Automation: Build Night"), and we already ingest them.

To stay complete as they publish:

1. **Ask them for a feed.** Email hello@build313.ai (or TechTown) for an `.ics`
   feed or a public JSON list of events. One line in `sources.ts` then keeps it
   current. This is the right fix; we deliberately do not read their database
   directly.
2. **Until then, use the manual file.** When a new Build Night is announced,
   add it to `data/manual-events.json` and re-run the ingest.

## Adding a source

Add one line to `SOURCES` in `scripts/events/sources.ts`:

- WordPress site with the Events Calendar plugin: `tribeSource(name, baseUrl, organizer)`.
  Check `<site>/wp-json/tribe/events/v1/events` returns JSON.
- Anything with a calendar feed: `icsSource(name, feedUrl, organizer)`.
- A Meetup group: `meetup('<group-slug>', 'Group name')`.
- A Luma city page: `lumaSource('<city-slug>')`.

Set `localOrganizer: true` if the organiser is Detroit-based (events with no
address are then kept), and `mayBeEmpty: true` if having no events is normal.
A source that returns nothing without `mayBeEmpty` is flagged in the run output.

## Not covered, and why

- **Facebook groups and Eventbrite:** their terms restrict automated reads. Use
  the manual file for events that only exist there.
- **Michigan Central:** its API has no event dates (only when the post was
  published); the dates load in the browser from somewhere we have not found.
- **Detroit Public Library:** lists events through Eventbrite.
- **Newlab, Wayne State, U-M:** no feed found, or the site blocks automated requests.
- **More Meetup groups:** only groups with a working feed are listed. Send group
  names and they are one line each.
