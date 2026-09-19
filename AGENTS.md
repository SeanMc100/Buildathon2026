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
  `src/theme/`, `app.json`, `package.json`, `tsconfig.json`, `docs/`
- Matching engine: `src/matching/`
- Screens: `src/screens/`
- Content + pitch: `src/content/`, `pitch/`

## Expo
Expo SDK 57 differs from what most models were trained on. Read the
exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before
writing any code. Install native/Expo-aware packages with
`npx expo install <pkg>` (not `npm install`) so versions match the SDK.
Run `npm run typecheck` before opening a pull request.
