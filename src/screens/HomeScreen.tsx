// The front door. Screens slice.
//
// It used to be a wordmark, a one-line tagline and two buttons on an otherwise
// empty page, which told a first-time visitor nothing about what the app is or
// what is inside it. It now says what this is, shows the size of the catalog,
// and gives three ways in: answer the questions, browse everything, or look at
// what is on this week.

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CATALOG, EVENTS_PULLED_AT } from '../content';
import { useIntake } from '../intake';
import { isVisible } from '../matching';
import type { RootStackParamList } from '../navigation/types';
import { useSaved } from '../saved';
import { colors, radius, shadow, spacing, typography } from '../theme';
import { focusRing, isFocused } from '../web/focus';
import { isHovered } from '../web/hover';
import { useIsCompact } from '../web/layout';
import { audiencesFromAnswers, fitsAudience, isEntryRoute } from '../catalog';
import { formatDay } from './components/opportunityFacts';
import { Button, Pill } from './components/ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Destination = {
  title: string;
  body: string;
  count: string;
  onPress: () => void;
  soon?: boolean;
};

/** One way into the app: what is behind it, and how much of it there is. */
function DestinationCard({ destination }: { destination: Destination }) {
  const { title, body, count, onPress, soon } = destination;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${count}. ${body}`}
      style={(state) => [
        styles.destination,
        isHovered(state) && styles.destinationHover,
        state.pressed && styles.destinationPressed,
        isFocused(state) && focusRing,
      ]}
    >
      <View style={styles.destinationHead}>
        <Text style={styles.destinationTitle}>{title}</Text>
        {soon ? <Pill text="Coming soon" tone="caution" /> : null}
      </View>
      <Text style={styles.destinationCount}>{count}</Text>
      <Text style={styles.destinationBody}>{body}</Text>
    </Pressable>
  );
}

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { profile, state, answers } = useIntake();
  const { count: savedCount } = useSaved();
  const compact = useIsCompact();

  const counts = useMemo(() => {
    const now = new Date();
    const live = CATALOG.filter((item) => isVisible(item, now));
    const audiences = audiencesFromAnswers(answers);
    const jobs = live.filter((item) => item.kind === 'job');
    return {
      jobs: jobs.filter((item) => !isEntryRoute(item)).length,
      internships: jobs.filter(isEntryRoute).length,
      programs: live.filter((item) => item.kind === 'program').length,
      research: live.filter((item) => item.kind === 'research').length,
      // The same audience rule the mentorship list applies, so the two counts agree.
      mentorships: live.filter(
        (item) => item.kind === 'mentorship' && fitsAudience(item, audiences),
      ).length,
      events: live.filter((item) => item.kind === 'event').length,
      total: live.length,
    };
  }, [answers]);

  const started = state.status !== 'not_started';

  const destinations: Destination[] = [
    {
      title: 'Browse everything',
      count: `${counts.jobs + counts.internships + counts.programs + counts.research} openings`,
      body: `${counts.jobs} job types, ${counts.internships} internships and apprenticeships, ${counts.programs} training programs and ${counts.research} research places. Search and filter the lot.`,
      onPress: () => navigation.navigate('OpportunityList'),
    },
    {
      title: 'Mentorship programs',
      count: `${counts.mentorships} programs`,
      body: 'Programs run by other organisations, listed by who can join. Each one links to its own site.',
      onPress: () => navigation.navigate('OpportunityList', { kind: 'mentorship' }),
    },
    {
      title: 'Detroit events',
      count: `${counts.events} coming up`,
      body: EVENTS_PULLED_AT
        ? `Career fairs, workshops and meetups, pulled from live listings on ${formatDay(EVENTS_PULLED_AT)}.`
        : 'Career fairs, workshops and meetups happening near you.',
      onPress: () => navigation.navigate('Events'),
    },
    {
      title: 'Bulletin boards',
      count: 'By age group and field',
      body: 'Talk to people at the same stage as you, and share leads you come across.',
      onPress: () => navigation.navigate('Boards'),
    },
    {
      title: 'Resume help',
      count: 'Not ready yet',
      body: 'A guided way to put a resume together. We are still building it.',
      onPress: () => navigation.navigate('Resumes'),
      soon: true,
    },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={[styles.hero, !compact && styles.heroWide]}>
        <Text style={styles.eyebrow}>METRO DETROIT</Text>
        <Text style={[styles.title, !compact && styles.titleWide]}>
          Work that fits what you actually want
        </Text>
        <Text style={[styles.lede, !compact && styles.ledeWide]}>
          Answer a few short questions about what you would trade and what you would not. We score
          every job, program, internship and research place we know of in metro Detroit against
          your answers, and show you why each one fits.
        </Text>

        <View style={[styles.actions, !compact && styles.actionsWide]}>
          <Button
            label={profile ? 'See my matches' : started ? 'Pick up where I left off' : 'Find my matches'}
            size="lg"
            onPress={() => navigation.navigate(profile ? 'Results' : 'IntakeIntro')}
          />
          <Button
            label="Browse without answering"
            variant="secondary"
            size="lg"
            onPress={() => navigation.navigate('OpportunityList')}
          />
        </View>

        <Text style={styles.reassurance}>
          About four minutes · skip anything · your answers stay on this device
        </Text>
      </View>

      <View style={styles.sectionWrap}>
        <View style={styles.sectionInner}>
          <Text style={styles.sectionTitle}>What is in here</Text>
          <View style={styles.destinations}>
            {destinations.map((destination) => (
              <View key={destination.title} style={compact ? styles.cellFull : styles.cellHalf}>
                <DestinationCard destination={destination} />
              </View>
            ))}
          </View>

          {profile || savedCount > 0 ? (
            <View style={[styles.returning, compact && styles.returningCompact]}>
              <Text style={styles.returningText}>
                {savedCount > 0
                  ? `You have ${savedCount} saved ${savedCount === 1 ? 'opportunity' : 'opportunities'}.`
                  : 'Your profile is saved on this device.'}
              </Text>
              <View style={[styles.returningActions, compact && styles.returningActionsCompact]}>
                {savedCount > 0 ? (
                  <Button
                    label="Open my shortlist"
                    variant="secondary"
                    onPress={() => navigation.navigate('Saved')}
                  />
                ) : null}
                {profile ? (
                  <Button
                    label="View my profile"
                    variant="ghost"
                    onPress={() => navigation.navigate('Profile')}
                  />
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

const MAX_WIDTH = 1120;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },

  hero: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  heroWide: { alignItems: 'center', paddingTop: spacing.xxl, paddingBottom: spacing.xxl },
  eyebrow: { ...typography.label, color: colors.primary, letterSpacing: 1.2 },
  title: { ...typography.display, color: colors.text, lineHeight: 38 },
  titleWide: { fontSize: 46, lineHeight: 54, textAlign: 'center', maxWidth: 760 },
  lede: { ...typography.body, color: colors.textMuted, lineHeight: 26, marginTop: spacing.xs },
  ledeWide: { fontSize: 18, lineHeight: 30, textAlign: 'center', maxWidth: 680 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  actionsWide: { justifyContent: 'center', gap: spacing.md },
  reassurance: { ...typography.caption, color: colors.textMuted, marginTop: spacing.md },

  sectionWrap: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  sectionInner: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: { ...typography.title, color: colors.text },

  destinations: { flexDirection: 'row', flexWrap: 'wrap', margin: -spacing.sm },
  cellFull: { width: '100%', padding: spacing.sm },
  cellHalf: { width: '50%', padding: spacing.sm },

  destination: {
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    ...shadow.sm,
  },
  destinationHover: { borderColor: colors.primaryBorder, ...shadow.md },
  destinationPressed: { backgroundColor: colors.surface },
  destinationHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  destinationTitle: { ...typography.heading, color: colors.text },
  destinationCount: { ...typography.subheading, color: colors.primary },
  destinationBody: { ...typography.caption, color: colors.textMuted, lineHeight: 21 },

  returning: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
  returningText: { ...typography.caption, color: colors.text, fontWeight: '600' },
  returningActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  // On a phone the card is a plain column, so its buttons fill it edge to edge
  // rather than sizing against a group that is only as wide as its content.
  returningCompact: { flexDirection: 'column', alignItems: 'stretch', flexWrap: 'nowrap' },
  returningActionsCompact: { flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch' },
});
