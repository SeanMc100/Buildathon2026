# Web build

Run it with `npm run web`. Build the static site with `npm run build:web`
(output in `dist/`). The export is a single-page app, so the host must serve
`index.html` for every path, or refreshing `/matches` returns a 404.

## URLs

Every screen has a path (see `src/navigation/linking.ts`): `/`, `/intake`,
`/intake/:questionId`, `/profile`, `/matches`, `/browse/:kind` (`job`,
`internship`, `program` or `research`), `/events`, `/boards`, `/boards/:boardId`,
`/boards/:boardId/share`, `/resumes` and `/support`. Linking is off on native. A
new screen needs an entry in `linking.ts` (route and tab title) as well as
`RootNavigator.tsx` and `types.ts`.

## Top menu

The sections live in the `SECTIONS` list in `src/web/TopBar.tsx`. Windows 1200px
and wider show them inline; anything narrower, phones included, folds them into
a menu. To add one, add an entry there.

Jobs, Internships, Programs and Research Programs are one screen,
`OpportunityListScreen`, told apart by its `kind`. Internships are jobs whose
`employmentType` is `Internship`; Jobs is every other job. With a profile the
list is ranked, with the matches first and the listings the matcher ruled out
after them, unscored. Without one it lists everything.

Resumes is a placeholder. Support's questions are in `src/content/support.ts`;
set `SUPPORT_EMAIL` there to turn on its contact button.

## Layout

`src/web/layout.tsx` wraps each screen in a frame, registered in `RootNavigator.tsx`:

| Frame     | Max width | Use for                                   |
|-----------|-----------|-------------------------------------------|
| `reading` | 680       | forms, profile, chat                      |
| `browse`  | 1120      | card lists; 1, 2 or 3 columns by width    |
| `full`    | none      | pages that lay themselves out (Home)      |

Phones (window under 640) get the layout the screens were designed for.

Rules for screen code:

- Size things from `useLayout()` (`width`, `columns`, `cardWidth`), not
  `useWindowDimensions()`. The window is wider than the column on desktop, and
  `width` already excludes the browser scrollbar.
- Lists of cards: `FlatList` with `numColumns={columns}`, `key={columns}`,
  `columnWrapperStyle` gap `GRID_GAP`, and `width={cardWidth}` on each card.
- Links that leave the app: `openExternal(url)` from `src/web/links.ts`, which
  opens a new tab on the web. `Linking.openURL` would replace the page.
- Hover styles: `isHovered(state)` from `src/web/hover.ts` inside a Pressable
  style function. It is always false on a phone.
