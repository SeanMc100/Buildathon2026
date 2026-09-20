// Plain HTML program pages, reduced to the part that describes the programme.
//
// WordPress REST hands back `content.rendered`, which is body copy and nothing
// else. A plain page does not: run htmlToText over a whole document and you get
// the navigation, the cookie banner, the "upgrade your browser" notice and the
// footer, and the extraction rules in extract.ts happily read a duration out of
// "4 year degree" in a menu. So strip the chrome first.
//
// Nothing here parses HTML properly — it does not need to. It needs to throw away
// the bits that are reliably not the programme.

import { htmlToText } from '../events/text';

/** Wrappers that never contain the programme description. */
const CHROME = /<(nav|header|footer|aside|form|noscript|svg|select)\b[\s\S]*?<\/\1>/gi;
const COMMENTS = /<!--[\s\S]*?-->/g;

/** Containers a page is likely to put its real content in, best first. */
const MAIN_REGIONS = [
  /<main\b[^>]*>([\s\S]*?)<\/main>/i,
  /<article\b[^>]*>([\s\S]*?)<\/article>/i,
  /<div\b[^>]*\b(?:id|class)="[^"]*\b(?:main-content|page-content|entry-content|content-area)\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  /<body\b[^>]*>([\s\S]*?)<\/body>/i,
];

/**
 * The visible text of a page's main region. Comments are dropped deliberately:
 * content an editor has commented out is not published, so it is not a fact.
 * (Detroit at Work, for instance, keeps a whole block of old cohort dates that
 * way — reading it would put stale dates on cards.)
 */
export function mainContent(html: string): string {
  const stripped = html.replace(COMMENTS, ' ').replace(CHROME, ' ');
  for (const region of MAIN_REGIONS) {
    const found = region.exec(stripped)?.[1];
    if (found && htmlToText(found).length >= 200) return htmlToText(found);
  }
  return htmlToText(stripped);
}

/** The page's own one-line description, when it publishes one. */
export function metaDescription(html: string): string | null {
  const match =
    /<meta[^>]+name="description"[^>]+content="([^"]{40,400})"/i.exec(html) ??
    /<meta[^>]+property="og:description"[^>]+content="([^"]{40,400})"/i.exec(html) ??
    /<meta[^>]+content="([^"]{40,400})"[^>]+name="description"/i.exec(html);
  if (!match) return null;
  const text = htmlToText(match[1]).replace(/\s+/g, ' ').trim();
  return text.length >= 40 ? text : null;
}
