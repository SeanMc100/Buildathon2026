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
      <Text style={styles.title}>Resumes</Text>
      <Text style={styles.body}>This section will help you create a resume. It is not ready yet.</Text>
      <View style={styles.action}>
        <Button label="Browse jobs" variant="secondary" onPress={() => navigation.navigate('OpportunityList', { kind: 'job' })} />
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
  body: { ...typography.body, color: colors.textMuted, lineHeight: 22 },
  action: { marginTop: spacing.lg, maxWidth: 280 },
});
