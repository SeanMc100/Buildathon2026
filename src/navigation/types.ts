import type { OpportunityKind } from '../models';

/**
 * A slice of the catalog you can browse. Internships are jobs whose employment
 * type is Internship or Apprenticeship, so 'job' here means every other job, and 'all' is the
 * unfiltered list the Browse tab opens on.
 */
export type ListKind = Exclude<OpportunityKind, 'event'> | 'internship';
export type BrowseKind = ListKind | 'all';

// Every screen registered in RootNavigator needs an entry here.
// `undefined` means the route takes no params.
export type RootStackParamList = {
  Home: undefined;
  IntakeIntro: undefined;
  /** One question per screen. The id keys into the content question bank. */
  IntakeQuestion: { questionId: string };
  Profile: undefined;
  Results: undefined;
  /** Every upcoming Detroit event, not just the top matches. */
  Events: undefined;
  /**
   * The catalog, searchable and filterable. `kind` seeds the type filter and
   * is left off by the Browse link, which opens on everything.
   */
  OpportunityList: { kind?: BrowseKind } | undefined;
  /** One listing in full, with the reasons behind its score. */
  OpportunityDetail: { id: string };
  /** Everything the visitor saved, across every kind. */
  Saved: undefined;
  /** Directory of Metro Detroit boards to join or leave. */
  Boards: undefined;
  Board: { boardId: string };
  /** Share an outside opportunity to one board. */
  BoardSubmit: { boardId: string };
  /** Help creating a resume. A placeholder until it is built. */
  Resumes: undefined;
  /** How the app works, privacy, and how to reach us. */
  Support: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
