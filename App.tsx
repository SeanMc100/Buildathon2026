import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BoardProvider, useBoard } from './src/board';
import { IntakeProvider, useIntake } from './src/intake';
import { documentTitle, linking } from './src/navigation/linking';
import { RootNavigator } from './src/navigation/RootNavigator';

// On the web the first screen is chosen by the URL, so a refresh on /matches would
// otherwise paint "answer a few questions" before the saved profile has loaded.
function HydrationGate({ children }: { children: React.ReactNode }) {
  const intake = useIntake();
  const board = useBoard();
  if (Platform.OS === 'web' && !(intake.hydrated && board.hydrated)) return null;
  return <>{children}</>;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <IntakeProvider>
        <BoardProvider>
          <HydrationGate>
            <NavigationContainer
              linking={linking}
              documentTitle={{ formatter: (_options, route) => documentTitle(route) }}
            >
              <RootNavigator />
            </NavigationContainer>
          </HydrationGate>
        </BoardProvider>
      </IntakeProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
