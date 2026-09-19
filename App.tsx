import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { IntakeProvider } from './src/intake';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <IntakeProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </IntakeProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
