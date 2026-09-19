import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { useIntake } from '../intake';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';
import { Button } from './components/ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { profile, state } = useIntake();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Buildathon App</Text>
      <Text style={styles.subtitle}>
        Tell us what you would actually trade, and we point a model at the rest.
      </Text>
      <View style={styles.actions}>
        <Button
          label={state.status === 'not_started' ? 'Build my profile' : 'Continue my profile'}
          onPress={() => navigation.navigate('IntakeIntro')}
        />
        {profile ? (
          <Button label="View my profile" variant="secondary" onPress={() => navigation.navigate('Profile')} />
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
});
