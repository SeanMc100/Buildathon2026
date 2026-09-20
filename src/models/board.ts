// The Metro Detroit bulletin board: category boards people join, chat in, and
// post outside opportunities to. Sean owns this file. Mirrors docs/schema.json.
//
// Membership is self-declared. Nothing here proves someone is in an age band or
// a field, so the app treats a board as a room people choose, not a credential.

/** Age boards are one-of (you are in one age band); job boards are many-of. */
export type BoardCategory = 'age' | 'job';

export type Board = {
  /** Stable slug, unique across boards. */
  id: string;
  category: BoardCategory;
  name: string;
  /** One line shown under the name. */
  blurb: string;
  /**
   * Age boards only: the `age_band` questionnaire answer this board lines up
   * with, so the directory can suggest it. Read locally, never sent anywhere.
   */
  ageBand?: string;
};

/** What a member is sharing that is not already in the catalog. */
export type BoardPostKind = 'job' | 'research' | 'program' | 'event' | 'other';

type BoardAuthored = {
  id: string;
  boardId: string;
  /** Stable per-install id, so the app can tell "mine" from everyone else's. */
  authorId: string;
  /** Anonymous display name, e.g. "Member 4821". Never a real name by default. */
  authorHandle: string;
  /** ISO date-time. */
  postedAt: string;
  /** True for placeholder entries. The UI must label these as samples. */
  isSample: boolean;
};

export type BoardMessage = BoardAuthored & {
  body: string;
};

/** A member-submitted lead: a job, research spot, program or event. */
export type BoardPost = BoardAuthored & {
  kind: BoardPostKind;
  title: string;
  organization: string;
  /** A Metro Detroit city, or 'Remote'. */
  city: string;
  /** http(s) only. Null when the member had no link. */
  url: string | null;
  details: string;
};

/** What the submit form hands to the store; the store fills in the rest. */
export type BoardPostInput = Pick<
  BoardPost,
  'kind' | 'title' | 'organization' | 'city' | 'url' | 'details'
>;

/** Persisted per install. Seed content is not stored, only what the member did. */
export type BoardState = {
  version: number;
  memberId: string;
  handle: string;
  /** Board ids the member joined. At most one is an age board. */
  joined: string[];
  messages: BoardMessage[];
  posts: BoardPost[];
};
