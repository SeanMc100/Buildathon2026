import type { OpportunityKind } from '../models';

/**
 * The lists reachable from the menu. Internships are jobs whose employment type
 * is Internship, so 'job' here means every other job.
 */
export type ListKind = Exclude<OpportunityKind, 'event'> | 'internship';

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
  /** Every listing of one kind, ranked when there is a profile and unscored when there is not. */
  OpportunityList: { kind: ListKind };
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
