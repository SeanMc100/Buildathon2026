// The output of the flow: the profile we derived, and the exact request we
// would send a matching model. Screens slice.

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EXCLUDED_ATTRIBUTES, ONET_ATTRIBUTION, QUESTION_BANK, RESULT_COPY } from '../content';
import { useIntake } from '../intake';
import { buildMatchRequest, formatMatchRequest, submitProfile } from '../matching';
import type { MatchOutcome } from '../matching';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import {
  ConstraintList,
  DialRow,
  FactRow,
  InterestRow,
  PriorityList,
  ProfileBlock,
  humanize,
} from './components/ProfileSections';
import { Button, Card } from './components/ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PACE_TEXT = { Steady: 'Steady and predictable', Mixed: 'Calm with busy stretches', Intense: 'Fast and full' };
const CHALLENGE_TEXT = {
  Energised: 'Deadlines sharpen them',
  Neutral: 'Depends on the week',
  Drained: 'Deadlines wear them down',
};
const TEAM_TEXT = { Solo: 'Heads-down alone', SmallTeam: 'Small close team', LargeOrg: 'Large organisation' };
const PREPARATION_TEXT = {
  1: 'Little preparation needed',
  2: 'Some preparation',
  3: 'Training or an associate degree',
  4: "Bachelor's degree level",
  5: 'Advanced degree level',
};

/** The generated summary runs long; clamp it so the sections below stay in view. */
const NARRATIVE_LINES = 4;
const NARRATIVE_CLAMP_CHARS = 200;

function outcomeSummary(outcome: MatchOutcome): { text: string; isError: boolean } {
  if (outcome.status === 'sent') {
    return { text: `${outcome.response.recommendations?.length ?? 0} opportunities returned`, isError: false };
  }
  if (outcome.status === 'not_configured') {
    return { text: "Matching isn't connected yet", isError: false };
  }
  return { text: "Couldn't reach the matching service", isError: true };
}

export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { profile } = useIntake();

  const [showFullNarrative, setShowFullNarrative] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [showPayload, setShowPayload] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<MatchOutcome | null>(null);

  const request = useMemo(() => (profile ? buildMatchRequest(profile) : null), [profile]);
  const payloadText = useMemo(() => (request ? formatMatchRequest(request) : ''), [request]);

  if (!profile || !request) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Answer a few questions first and your profile appears here.</Text>
        <Button label="Start the questionnaire" onPress={() => navigation.replace('IntakeIntro')} />
      </View>
    );
  }

  const send = async () => {
    setSending(true);
    setOutcome(await submitProfile(profile));
    setSending(false);
  };

  const copy = async () => {
    await Clipboard.setStringAsync(payloadText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const style = profile.workStyle;
  const status = outcome ? outcomeSummary(outcome) : null;
  const longNarrative = profile.narrativeSummary.length > NARRATIVE_CLAMP_CHARS;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{RESULT_COPY.title}</Text>
          <Text style={styles.coverage}>
            Based on {Math.round(profile.completeness * 100)}% of the questions
          </Text>
        </View>

        <Card style={styles.narrativeCard}>
          <Text
            style={styles.narrative}
            numberOfLines={showFullNarrative || !longNarrative ? undefined : NARRATIVE_LINES}
          >
            {profile.narrativeSummary}
          </Text>
          {longNarrative ? (
            <Pressable onPress={() => setShowFullNarrative((current) => !current)} hitSlop={8}>
              <Text style={styles.link}>{showFullNarrative ? 'Show less' : 'Read more'}</Text>
            </Pressable>
          ) : null}
        </Card>
        <Text style={styles.hint}>Tap any row below to see why we think it.</Text>

        <ProfileBlock title="What matters most">
          <PriorityList priorities={profile.priorities} />
        </ProfileBlock>

        <ProfileBlock title="How you work">
          <DialRow
            label="Autonomy"
            lowLabel="Clear direction"
            highLabel="My own call"
            inference={style.autonomy}
          />
          <DialRow
            label="Range"
            lowLabel="Deep on one thing"
            highLabel="A bit of everything"
            inference={style.variety}
          />
          <FactRow
            label="Pace"
            value={PACE_TEXT[style.pace.value]}
            confidence={style.pace.confidence}
            sources={style.pace.sourceQuestionIds}
          />
          <FactRow
            label="Pressure"
            value={CHALLENGE_TEXT[style.challengeAppetite.value]}
            confidence={style.challengeAppetite.confidence}
            sources={style.challengeAppetite.sourceQuestionIds}
          />
          <FactRow
            label="People"
            value={TEAM_TEXT[style.teamShape.value]}
            confidence={style.teamShape.confidence}
            sources={style.teamShape.sourceQuestionIds}
          />
          <InterestRow profile={profile} />
        </ProfileBlock>

        <ProfileBlock title="Where you are">
          <FactRow
            label="Stage"
            value={humanize(profile.stage.value)}
            confidence={profile.stage.confidence}
            sources={profile.stage.sourceQuestionIds}
          />
          <FactRow
            label="Preparation"
            value={PREPARATION_TEXT[profile.jobZone.value]}
            confidence={profile.jobZone.confidence}
            sources={profile.jobZone.sourceQuestionIds}
          />
          {profile.focusArea ? <FactRow label="Focus" value={profile.focusArea} /> : null}
          {profile.workValues.value.length > 0 ? (
            <FactRow
              label="Work values"
              value={profile.workValues.value.map(humanize).join(', ')}
              confidence={profile.workValues.confidence}
              sources={profile.workValues.sourceQuestionIds}
            />
          ) : null}
        </ProfileBlock>

        <ProfileBlock title="Your deal-breakers">
          <ConstraintList profile={profile} />
        </ProfileBlock>

        {profile.extraContext ? (
          <ProfileBlock title="In your words">
            <Text style={styles.quote}>{profile.extraContext}</Text>
          </ProfileBlock>
        ) : null}

        <View style={styles.team}>
          <Pressable
            onPress={() => setShowTeam((current) => !current)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ expanded: showTeam }}
            style={styles.teamHeader}
          >
            <Text style={styles.teamTitle}>For the team</Text>
            <Text style={styles.link}>{showTeam ? 'Hide' : 'Show'}</Text>
          </Pressable>

          {showTeam ? (
            <View style={styles.teamBody}>
              <Text style={styles.teamText}>{RESULT_COPY.payloadBody}</Text>
              <Pressable onPress={() => setShowPayload((current) => !current)} hitSlop={8}>
                <Text style={styles.link}>{showPayload ? 'Hide JSON' : 'Show JSON'}</Text>
              </Pressable>
              {showPayload ? (
                <View style={styles.codeBox}>
                  <Text style={styles.code}>{payloadText}</Text>
                </View>
              ) : null}
              <Button
                label={copied ? 'Copied' : 'Copy request'}
                variant="secondary"
                onPress={copy}
              />

              {outcome ? (
                <View style={styles.outcome}>
                  <Text style={styles.outcomeTitle}>{status?.text}</Text>
                  <Text style={styles.teamText}>
                    {outcome.status === 'not_configured'
                      ? 'Set expo.extra.matchingEndpoint in app.json. Until then the request is built but not sent.'
                      : outcome.status === 'error'
                        ? outcome.message
                        : 'Recommendations are on the response, each citing the questions that drove it.'}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.legalTitle}>Not collected, not inferred, not sent</Text>
              <Text style={styles.legalBody}>
                {EXCLUDED_ATTRIBUTES.join(' · ').replace(/_/g, ' ')}
              </Text>
              <Text style={styles.legalBody}>{ONET_ATTRIBUTION}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {status ? (
          <Text style={[styles.status, status.isError && styles.statusError]}>{status.text}</Text>
        ) : null}
        <Button
          label={sending ? 'Sending…' : RESULT_COPY.send}
          onPress={send}
          disabled={sending}
        />
        <Button
          label={RESULT_COPY.retake}
          variant="ghost"
          onPress={() => navigation.replace('IntakeQuestion', { questionId: QUESTION_BANK[0].id })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg + 4 },

  header: { gap: spacing.xs },
  title: { ...typography.display, color: colors.text },
  coverage: { ...typography.caption, color: colors.textMuted },

  narrativeCard: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft, gap: spacing.sm },
  narrative: { ...typography.body, color: colors.text, lineHeight: 24 },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: -spacing.sm },

  quote: { ...typography.body, color: colors.text, fontStyle: 'italic', lineHeight: 22 },

  team: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  teamHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  teamTitle: { ...typography.body, color: colors.textMuted, fontWeight: '600' },
  teamBody: { gap: spacing.sm },
  teamText: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  link: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  codeBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  code: { fontFamily: 'Courier', fontSize: 10, lineHeight: 14, color: colors.text },
  outcome: { gap: spacing.xs },
  outcomeTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  legalTitle: { ...typography.label, color: colors.textMuted, letterSpacing: 0.6, marginTop: spacing.sm },
  legalBody: { ...typography.caption, color: colors.textMuted, fontSize: 11, lineHeight: 16 },

  bar: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  status: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  statusError: { color: colors.danger },

  empty: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
