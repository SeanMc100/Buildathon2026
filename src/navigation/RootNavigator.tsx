import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HomeScreen } from '../screens/HomeScreen';
import { IntakeIntroScreen } from '../screens/IntakeIntroScreen';
import { IntakeQuestionScreen } from '../screens/IntakeQuestionScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Sean owns this file. To add a screen, build it in src/screens/ and ask
// Sean to register it here and in ./types.ts.
export function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="Home">
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Stack.Screen
        name="IntakeIntro"
        component={IntakeIntroScreen}
        options={{ title: 'Career intake' }}
      />
      <Stack.Screen
        name="IntakeQuestion"
        component={IntakeQuestionScreen}
        options={{ title: '', headerBackTitle: 'Exit' }}
      />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Your profile' }} />
    </Stack.Navigator>
  );
}
