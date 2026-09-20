import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { useIntake } from '../intake';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';
import { useIsCompact } from '../web/layout';
import { Button } from './components/ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { profile, state } = useIntake();
  // Phones keep the left-aligned stack; wider windows get a centred hero.
  const hero = !useIsCompact();

  return (
    <View style={[styles.container, hero && styles.containerHero]}>
      <Text style={[styles.title, hero && styles.titleHero]}>Buildathon App</Text>
      <Text style={[styles.subtitle, hero && styles.subtitleHero]}>
        Tell us what you would actually trade, and we point a model at the rest.
      </Text>
      <View style={[styles.actions, hero && styles.actionsHero]}>
        <View style={hero && styles.action}>
          <Button
            label={state.status === 'not_started' ? 'Build my profile' : 'Continue my profile'}
            onPress={() => navigation.navigate('IntakeIntro')}
          />
        </View>
        {profile ? (
          <View style={hero && styles.action}>
            <Button label="View my profile" variant="secondary" onPress={() => navigation.navigate('Profile')} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { ...typography.display, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, lineHeight: 22 },
  actions: { gap: spacing.sm, marginTop: spacing.lg },

  containerHero: { alignItems: 'center', paddingBottom: spacing.xxl * 2 },
  titleHero: { fontSize: 48, lineHeight: 56, textAlign: 'center' },
  subtitleHero: { fontSize: 19, lineHeight: 28, textAlign: 'center', maxWidth: 560 },
  actionsHero: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md },
  action: { minWidth: 220 },
});
