import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme';

export function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Buildathon App</Text>
      <Text style={styles.subtitle}>Foundation is up. Replace this screen.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  subtitle: { marginTop: spacing.sm, fontSize: 16, color: colors.textMuted },
});
