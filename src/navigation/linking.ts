import type { LinkingOptions } from '@react-navigation/native';
import { Platform } from 'react-native';

import type { ListKind, RootStackParamList } from './types';

// Gives every screen a real URL on the web, so refresh, back/forward and
// shared links work. Native builds have no URL prefixes, so this stays off there.
export const linking: LinkingOptions<RootStackParamList> = {
  enabled: Platform.OS === 'web',
  prefixes: [],
  config: {
    screens: {
      Home: '',
      IntakeIntro: 'intake',
      IntakeQuestion: 'intake/:questionId',
      Profile: 'profile',
      Results: 'matches',
      OpportunityList: 'browse/:kind',
      Events: 'events',
      Boards: 'boards',
      Board: 'boards/:boardId',
      BoardSubmit: 'boards/:boardId/share',
      Resumes: 'resumes',
      Support: 'support',
    },
  },
};

/** Browser tab titles. Most screens draw their own heading, so the header title is blank. */
const PAGE_TITLES: Record<keyof RootStackParamList, string> = {
  Home: 'Buildathon App',
  IntakeIntro: 'Career intake',
  IntakeQuestion: 'Career intake',
  Profile: 'Your profile',
  Results: 'Your matches',
  OpportunityList: 'Your matches',
  Events: 'Detroit events',
  Boards: 'Bulletin boards',
  Board: 'Bulletin boards',
  BoardSubmit: 'Share a lead',
  Resumes: 'Resumes',
  Support: 'Support',
};

const LIST_PAGE_TITLES: Record<ListKind, string> = {
  job: 'Jobs',
  internship: 'Internships',
  program: 'Programs',
  research: 'Research programs',
};

export function documentTitle(
  route: { name: string; params?: object } | undefined,
): string {
  const name = route?.name as keyof RootStackParamList | undefined;
  const kind = (route?.params as { kind?: ListKind } | undefined)?.kind;
  const page = name === 'OpportunityList' && kind ? LIST_PAGE_TITLES[kind] : name && PAGE_TITLES[name];
  return !page || page === 'Buildathon App' ? 'Buildathon App' : `${page} · Buildathon App`;
}
