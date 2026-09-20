// One opportunity in full. Screens slice.
//
// Every card used to link straight out to someone else's website, which meant
// there was nowhere to read the whole listing, see the reasoning behind a
// score, or put something aside. This is that place; the outbound link is the
// last step rather than the only one.

import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CATALOG } from '../content';
import { useIntake } from '../intake';
import { rankKind } from '../matching';
import type { Opportunity, OpportunityMatch } from '../models';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import { openExternal } from '../web/links';
import { ScoreBadge, SaveButton } from './components/OpportunityCard';
import {
  deadlineLine,
  eventWhen,
  formatDay,
  headlineFact,
  humanize,
  isDeadlineSoon,
  kindLabel,
  money,
  placeLine,
  scoreBand,
} from './components/opportunityFacts';
import { Button, Card, EmptyState, Pill, SectionHeading } from './components/ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CATALOG_BY_ID = new Map<string, Opportunity>(CATALOG.map((item) => [item.id, item]));

const EDUCATION_TEXT: Record<string, string> = {
  none_required: 'No formal qualification needed',
  secondary: 'School or secondary level',
  certificate: 'A certificate, trade or apprenticeship',
  associate: 'An associate degree or diploma',
  bachelor: "A bachelor's degree",
  postgraduate: 'A postgraduate degree',
};

type Fact = { label: string; value: string };

/** The facts worth a row of their own, in the order they matter. */
function factsFor(item: Opportunity): Fact[] {
  const facts: Fact[] = [];
  const where = placeLine(item);
  if (where) facts.push({ label: 'Where', value: where });

  switch (item.kind) {
    case 'job': {
      facts.push({ label: 'Type', value: humanize(item.employmentType) });
      if (item.payMinUsd !== null || item.payMaxUsd !== null) {
        const low = item.payMinUsd !== null ? money(item.payMinUsd) : '?';
        const high = item.payMaxUsd !== null ? money(item.payMaxUsd) : '?';
        facts.push({ label: 'Pay', value: `${low}–${high} a year` });
      }
      if (item.detroit?.sector) facts.push({ label: 'Sector', value: item.detroit.sector });
      if (item.detroit?.localEmployment) {
        facts.push({
          label: 'Jobs locally',
          value: `${item.detroit.localEmployment.toLocaleString('en-US')} in metro Detroit`,
        });
      }
      if (item.detroit?.outlook?.percentChange !== undefined && item.detroit.outlook.percentChange !== null) {
        const change = item.detroit.outlook.percentChange;
        facts.push({
          label: 'Outlook',
          value: `${change > 0 ? '+' : ''}${change}% by ${item.detroit.outlook.projectedYear} (${item.detroit.outlook.area})`,
        });
      }
      break;
    }
    case 'program': {
      if (item.costUsd !== null) {
        facts.push({ label: 'Cost', value: item.costUsd === 0 ? 'Free' : money(item.costUsd) });
      }
      if (item.stipendUsd) facts.push({ label: 'Stipend', value: money(item.stipendUsd) });
      if (item.durationWeeks) facts.push({ label: 'Length', value: `${item.durationWeeks} weeks` });
      if (item.startsAt) facts.push({ label: 'Starts', value: formatDay(item.startsAt) });
      if (item.program?.cadence && item.program.cadence !== 'unknown') {
        facts.push({ label: 'Runs', value: humanize(item.program.cadence) });
      }
      if (item.program?.applicationMethod && item.program.applicationMethod !== 'unknown') {
        facts.push({ label: 'Apply by', value: humanize(item.program.applicationMethod) });
      }
      break;
    }
    case 'research': {
      facts.push({ label: 'Field', value: item.field });
      if (item.stipendUsd) facts.push({ label: 'Stipend', value: money(item.stipendUsd) });
      if (item.durationWeeks) facts.push({ label: 'Length', value: `${item.durationWeeks} weeks` });
      if (item.startsAt) facts.push({ label: 'Starts', value: formatDay(item.startsAt) });
      if (item.research?.institution) {
        facts.push({ label: 'Institution', value: item.research.institution });
      }
      break;
    }
    case 'event': {
      const when = eventWhen(item);
      if (when) facts.push({ label: 'When', value: when });
      facts.push({ label: 'Format', value: humanize(item.format) });
      if (item.costUsd !== null) {
        facts.push({ label: 'Cost', value: item.costUsd === 0 ? 'Free' : money(item.costUsd) });
      }
      break;
    }
  }

  facts.push({ label: 'Preparation', value: EDUCATION_TEXT[item.minEducation] ?? item.minEducation });
  const deadline = deadlineLine(item);
  if (deadline) facts.push({ label: 'Deadline', value: deadline.replace('Apply by ', '') });
  return facts;
}

function eligibilityFor(item: Opportunity): string[] {
  return item.kind === 'program' || item.kind === 'research' ? item.eligibility : [];
}

export function OpportunityDetailScreen() {
  const { params } = useRoute<NativeStackScreenProps<RootStackParamList, 'OpportunityDetail'>['route']>();
  const navigation = useNavigation<Nav>();
  const { profile } = useIntake();

  const item = CATALOG_BY_ID.get(params.id);

  // The matcher is the single source of a score, so this asks it rather than
  // scoring again here and risking a different number from the card.
  const match = useMemo<OpportunityMatch | null>(() => {
    if (!profile || !item) return null;
    return rankKind(item.kind, profile, CATALOG).find((row) => row.opportunityId === item.id) ?? null;
  }, [profile, item]);

  if (!item) {
    return (
      <View style={styles.missing}>
        <EmptyState
          title="That listing is no longer here"
          body="It may have closed, or the link may be out of date."
          action={{ label: 'Browse opportunities', onPress: () => navigation.replace('OpportunityList') }}
        />
      </View>
    );
  }

  const facts = factsFor(item);
  const eligibility = eligibilityFor(item);
  const headline = headlineFact(item);
  const band = match ? scoreBand(match.matchScore) : null;
  const soon = isDeadlineSoon(item);
  const entryRoutes = item.kind === 'job' ? (item.detroit?.entryRoutes ?? []) : [];
  const hiringHere = item.kind === 'job' ? (item.detroit?.hiringHere ?? []) : [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <View style={styles.tags}>
          <Pill text={kindLabel(item)} tone="accent" />
          {item.isSample ? <Pill text="Sample listing" tone="caution" /> : null}
          {soon ? <Pill text="Closing soon" tone="caution" /> : null}
        </View>

        <Text style={styles.title} accessibilityRole="header">
          {item.title}
        </Text>
        <Text style={styles.org}>{item.organization}</Text>
        {placeLine(item) ? <Text style={styles.place}>{placeLine(item)}</Text> : null}
        {headline ? <Text style={styles.headline}>{headline}</Text> : null}
      </View>

      <View style={styles.actions}>
        <Button
          label="Open the full listing"
          onPress={() => openExternal(item.url)}
          accessibilityLabel={`Open the full listing for ${item.title} in a new tab`}
        />
        <SaveButton id={item.id} title={item.title} />
      </View>

      <Text style={styles.summary}>{item.summary}</Text>

      {match ? (
        <Card style={styles.fitCard}>
          <View style={styles.fitHead}>
            <ScoreBadge score={match.matchScore} />
            <View style={styles.fitHeadText}>
              <Text style={styles.fitTitle}>{band?.label} for you</Text>
              <Text style={styles.fitHelp}>
                Scored out of 100 against your answers. Everything below is why.
              </Text>
            </View>
          </View>

          {match.whyItFits.length > 0 ? (
            <View style={styles.reasons}>
              <Text style={styles.reasonHeading}>What fits</Text>
              {match.whyItFits.map((line) => (
                <Text key={line} style={styles.fit}>
                  ✓ {line}
                </Text>
              ))}
            </View>
          ) : null}

          {match.gaps.length > 0 ? (
            <View style={styles.reasons}>
              <Text style={styles.reasonHeading}>What to weigh up</Text>
              {match.gaps.map((line) => (
                <Text key={line} style={styles.gap}>
                  – {line}
                </Text>
              ))}
            </View>
          ) : null}
        </Card>
      ) : profile ? (
        <Card style={styles.clashCard}>
          <Text style={styles.clashTitle}>This one clashes with a deal-breaker</Text>
          <Text style={styles.clashBody}>
            It is outside the limits you set on the questionnaire, so it has no fit score. You can
            still read it and decide for yourself.
          </Text>
        </Card>
      ) : null}

      <View style={styles.block}>
        <SectionHeading title="The details" />
        <Card style={styles.factCard}>
          {facts.map((fact, index) => (
            <View key={fact.label} style={[styles.factRow, index > 0 && styles.factRowDivided]}>
              <Text style={styles.factLabel}>{fact.label}</Text>
              <Text style={styles.factValue}>{fact.value}</Text>
            </View>
          ))}
        </Card>
      </View>

      {eligibility.length > 0 ? (
        <View style={styles.block}>
          <SectionHeading title="Who it is for" />
          <Card style={styles.listCard}>
            {eligibility.map((line) => (
              <Text key={line} style={styles.bullet}>
                • {line}
              </Text>
            ))}
          </Card>
        </View>
      ) : null}

      {entryRoutes.length > 0 ? (
        <View style={styles.block}>
          <SectionHeading title="How people get in" />
          <Card style={styles.listCard}>
            {entryRoutes.map((line) => (
              <Text key={line} style={styles.bullet}>
                • {line}
              </Text>
            ))}
          </Card>
        </View>
      ) : null}

      {hiringHere.length > 0 ? (
        <View style={styles.block}>
          <SectionHeading title="Who hires for this locally" help="Curated, not a live vacancy list." />
          <Card style={styles.listCard}>
            {hiringHere.map((line) => (
              <Text key={line} style={styles.bullet}>
                • {line}
              </Text>
            ))}
          </Card>
        </View>
      ) : null}

      <View style={styles.provenance}>
        {item.kind === 'job' ? (
          <Text style={styles.provenanceText}>
            This is a type of work in metro Detroit rather than one employer's vacancy, so the pay
            is the local range for the occupation and the link goes to a live search.
          </Text>
        ) : null}
        {item.isSample ? (
          <Text style={styles.provenanceText}>
            A sample entry, written for the demo. It is not a real opportunity.
          </Text>
        ) : (
          <Text style={styles.provenanceText}>Last checked {formatDay(item.verifiedOn)}.</Text>
        )}
      </View>

      <View style={styles.footerActions}>
        <Button
          label="Open the full listing"
          onPress={() => openExternal(item.url)}
          accessibilityLabel={`Open the full listing for ${item.title} in a new tab`}
        />
        <Button
          label="Back to browsing"
          variant="secondary"
          onPress={() => navigation.navigate('OpportunityList')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  missing: { flex: 1, justifyContent: 'center', padding: spacing.lg },

  head: { gap: spacing.xs },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xs },
  title: { ...typography.display, color: colors.text, lineHeight: 38 },
  org: { ...typography.body, color: colors.text, fontWeight: '600' },
  place: { ...typography.caption, color: colors.textMuted },
  headline: { ...typography.heading, color: colors.text, marginTop: spacing.sm },

  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  summary: { ...typography.body, color: colors.text, lineHeight: 26 },

  fitCard: { backgroundColor: colors.surface, gap: spacing.md },
  fitHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  fitHeadText: { flex: 1, gap: 2 },
  fitTitle: { ...typography.heading, color: colors.text },
  fitHelp: { ...typography.caption, color: colors.textMuted, lineHeight: 20 },
  reasons: { gap: spacing.xs },
  reasonHeading: { ...typography.label, color: colors.textMuted, letterSpacing: 0.6 },
  fit: { ...typography.caption, color: colors.positive, lineHeight: 21 },
  gap: { ...typography.caption, color: colors.textMuted, lineHeight: 21 },

  clashCard: { backgroundColor: colors.cautionSoft, borderColor: colors.cautionSoft, gap: spacing.xs },
  clashTitle: { ...typography.subheading, color: colors.caution },
  clashBody: { ...typography.caption, color: colors.caution, lineHeight: 21 },

  block: { gap: spacing.sm },
  factCard: { padding: 0 },
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  factRowDivided: { borderTopWidth: 1, borderTopColor: colors.border },
  factLabel: { ...typography.caption, color: colors.textMuted },
  factValue: { ...typography.caption, color: colors.text, fontWeight: '600', flex: 1, textAlign: 'right' },

  listCard: { gap: spacing.xs },
  bullet: { ...typography.caption, color: colors.text, lineHeight: 22 },

  provenance: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  provenanceText: { ...typography.caption, color: colors.textMuted, lineHeight: 21 },

  footerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
