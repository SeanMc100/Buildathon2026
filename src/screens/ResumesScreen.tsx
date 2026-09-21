// Help creating a resume. A placeholder until the section is built. Screens slice.

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';
import { Button, Pill } from './components/ui';

export function ResumesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.screen}>
      <Pill text="Coming soon" tone="accent" />
      <Text style={styles.title} accessibilityRole="header">
        Resumes
      </Text>
      <Text style={styles.body}>
        A guided way to put a resume together, built from the profile you already answered. It is
        not ready yet, so nothing here will help you today.
      </Text>
      <View style={styles.action}>
        <Button
          label="Browse jobs instead"
          onPress={() => navigation.navigate('OpportunityList', { kind: 'job' })}
        />
        <Button
          label="See Detroit events"
          variant="secondary"
          onPress={() => navigation.navigate('Events')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { ...typography.display, color: colors.text },
  body: { ...typography.body, color: colors.textMuted, lineHeight: 26, maxWidth: 560 },
  action: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
});
