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
  PriorityBars,
  ProfileBlock,
} from './components/ProfileSections';
import { Button, Card, Pill, ProgressBar } from './components/ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PACE_TEXT = { Steady: 'Steady and predictable', Mixed: 'Calm with busy stretches', Intense: 'Fast and full' };
const CHALLENGE_TEXT = {
  Energised: 'Deadlines sharpen them',
  Neutral: 'Depends on the week',
  Drained: 'Deadlines wear them down',
};
const TEAM_TEXT = { Solo: 'Heads-down alone', SmallTeam: 'Small close team', LargeOrg: 'Large organisation' };

export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { profile } = useIntake();

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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
    >
      <Pill text={`${Math.round(profile.completeness * 100)}% answered`} tone="accent" />
      <Text style={styles.title}>{RESULT_COPY.title}</Text>
      <Text style={styles.subtitle}>{RESULT_COPY.subtitle}</Text>
      <ProgressBar ratio={profile.completeness} />

      <Card style={styles.narrativeCard}>
        <Text style={styles.narrative}>{profile.narrativeSummary}</Text>
      </Card>

      <ProfileBlock title="What you would trade">
        <PriorityBars priorities={profile.priorities} />
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
      </ProfileBlock>

      <ProfileBlock title="What pulls you in">
        <InterestRow profile={profile} />
      </ProfileBlock>

      <ProfileBlock title="Where you are">
        <FactRow
          label="Stage"
          value={profile.stage.value}
          confidence={profile.stage.confidence}
          sources={profile.stage.sourceQuestionIds}
        />
        <FactRow
          label="Preparation level"
          value={`Job Zone ${profile.jobZone.value} of 5`}
          confidence={profile.jobZone.confidence}
          sources={profile.jobZone.sourceQuestionIds}
        />
        {profile.focusArea ? <FactRow label="Focus" value={profile.focusArea} /> : null}
        {profile.workValues.value.length > 0 ? (
          <FactRow
            label="Work values"
            value={profile.workValues.value.join(', ')}
            confidence={profile.workValues.confidence}
            sources={profile.workValues.sourceQuestionIds}
          />
        ) : null}
      </ProfileBlock>

      <ProfileBlock title="Hard lines">
        <ConstraintList profile={profile} />
      </ProfileBlock>

      {profile.extraContext ? (
        <ProfileBlock title="In your words">
          <Text style={styles.quote}>{profile.extraContext}</Text>
        </ProfileBlock>
      ) : null}

      <ProfileBlock title={RESULT_COPY.payloadHeading}>
        <Text style={styles.payloadBody}>{RESULT_COPY.payloadBody}</Text>
        <Pressable onPress={() => setShowPayload((current) => !current)} hitSlop={8}>
          <Text style={styles.link}>{showPayload ? 'Hide JSON' : 'Show JSON'}</Text>
        </Pressable>
        {showPayload ? (
          <View style={styles.codeBox}>
            <Text style={styles.code}>{payloadText}</Text>
          </View>
        ) : null}
        <Button label={copied ? 'Copied' : 'Copy request'} variant="secondary" onPress={copy} />
      </ProfileBlock>

      {outcome ? (
        <Card style={styles.outcomeCard}>
          <Text style={styles.outcomeTitle}>
            {outcome.status === 'sent'
              ? `${outcome.response.recommendations?.length ?? 0} opportunities returned`
              : outcome.status === 'not_configured'
                ? 'No matching endpoint configured yet'
                : 'Could not reach the matching service'}
          </Text>
          <Text style={styles.outcomeBody}>
            {outcome.status === 'not_configured'
              ? 'Set expo.extra.matchingEndpoint in app.json. Until then the request above is built and shown but not sent.'
              : outcome.status === 'error'
                ? outcome.message
                : 'Recommendations are on the response, each citing the questions that drove it.'}
          </Text>
        </Card>
      ) : null}

      <View style={styles.actions}>
        <Button
          label={sending ? 'Sending…' : RESULT_COPY.send}
          onPress={send}
          disabled={sending}
        />
        <Button
          label={RESULT_COPY.retake}
          variant="secondary"
          onPress={() =>
            navigation.replace('IntakeQuestion', { questionId: QUESTION_BANK[0].id })
          }
        />
      </View>

      <View style={styles.legal}>
        <Text style={styles.legalTitle}>Not collected, not inferred, not sent</Text>
        <Text style={styles.legalBody}>{EXCLUDED_ATTRIBUTES.join(' · ').replace(/_/g, ' ')}</Text>
        <Text style={styles.legalBody}>{ONET_ATTRIBUTION}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  title: { ...typography.display, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: -spacing.md + 2 },

  narrativeCard: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  narrative: { ...typography.body, color: colors.text, lineHeight: 23 },

  quote: { ...typography.body, color: colors.text, fontStyle: 'italic', lineHeight: 22 },

  payloadBody: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  link: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  codeBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  code: { fontFamily: 'Courier', fontSize: 10, lineHeight: 14, color: colors.text },

  outcomeCard: { gap: spacing.xs },
  outcomeTitle: { ...typography.heading, color: colors.text },
  outcomeBody: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },

  actions: { gap: spacing.sm },

  legal: { gap: spacing.xs, marginTop: spacing.sm },
  legalTitle: { ...typography.label, color: colors.textMuted, letterSpacing: 0.6 },
  legalBody: { ...typography.caption, color: colors.textMuted, fontSize: 11, lineHeight: 16 },

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
