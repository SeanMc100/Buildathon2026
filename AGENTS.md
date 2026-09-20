# Team workflow (4 people, hackathon)

## Git rules
- Never commit or push directly to `main`. Never force-push.
- Before starting work: `git checkout main && git pull`, then
  create a branch: `git checkout -b <name>-<feature>`.
- Commit small and often with clear messages.
- To share work: `git pull origin main` into your branch,
  fix any conflicts, push the branch, and open a pull request.
- Ask the user before merging anything or resolving a conflict
  in a file they don't own.

## Ownership
- Only edit files in your owner's slice (listed below).
- Shared files (models, navigation, project config) are
  edited only by Sean. If a change is needed there, say so.

## Slices
- Sean: app shell, models, merges
- [Name]: matching engine
- [Name]: screens
- [Name]: content + pitch

## Contracts
- Data shapes live in /docs/schema.json. Don't change them
  without telling the team.

## Where each slice lives
- Sean: `App.tsx`, `index.ts`, `src/navigation/`, `src/models/`,
  `src/intake/`, `src/theme/`, `app.json`, `package.json`,
  `tsconfig.json`, `docs/`
- Matching engine: `src/matching/`
- Screens: `src/screens/`
- Content + pitch: `src/content/`, `pitch/`

## Expo
Expo SDK 57 differs from what most models were trained on. Read the
exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before
writing any code. Install native/Expo-aware packages with
`npx expo install <pkg>` (not `npm install`) so versions match the SDK.
Run `npm run typecheck` before opening a pull request.

## Context hygiene (don't read what you don't need)
Big files eat context and rarely help. Search first, read narrow.

- **Never read whole**: `data/*.json` (generated snapshots, ~29k lines; they
  are rewritten by `npm run ingest:*`, so never hand-edit them),
  `package-lock.json`, `docs/schema.json` (1.7k lines), `assets/`,
  `.cache/`, `node_modules/`, `.expo/`.
- To learn a data shape, read `docs/schema.json` via `grep -n "<TypeName>"`
  and then a small `offset`/`limit` window, or read the type in `src/models/`.
  To peek at data, use `head -c 1500 data/jobs.json` or
  `node -e` / `jq '.[0]'`, never a full read.
- Large source files (`scripts/research/registry.ts`, `scripts/jobs/*.ts`,
  `src/content/opportunities.ts`, `src/content/questionnaire.ts`): use
  Grep to find the symbol, then read only that range.
- Ingestion is described in `docs/ingestion.md`. Read that, not the scripts,
  unless you are changing a script.
- Don't run `ingest:*` to "check something"; it hits the network and
  rewrites `data/`. Use `npm run verify:catalog` instead.
- Keep command output short: pipe through `head`/`tail`, and prefer
  `npm run typecheck 2>&1 | tail -30`.
