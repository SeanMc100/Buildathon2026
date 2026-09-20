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
  /** Directory of Metro Detroit boards to join or leave. */
  Boards: undefined;
  Board: { boardId: string };
  /** Share an outside opportunity to one board. */
  BoardSubmit: { boardId: string };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
