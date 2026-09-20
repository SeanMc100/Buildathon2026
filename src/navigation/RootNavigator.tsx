import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { BoardScreen } from '../screens/BoardScreen';
import { BoardSubmitScreen } from '../screens/BoardSubmitScreen';
import { BoardsScreen } from '../screens/BoardsScreen';
import { EventsScreen } from '../screens/EventsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { IntakeIntroScreen } from '../screens/IntakeIntroScreen';
import { IntakeQuestionScreen } from '../screens/IntakeQuestionScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ResultsScreen } from '../screens/ResultsScreen';
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
      {/* The screen renders its own large title, so the header stays blank. */}
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: '' }} />
      <Stack.Screen name="Results" component={ResultsScreen} options={{ title: '' }} />
      <Stack.Screen name="Events" component={EventsScreen} options={{ title: '' }} />
      <Stack.Screen name="Boards" component={BoardsScreen} options={{ title: '' }} />
      {/* BoardScreen sets its own title from the board name. */}
      <Stack.Screen name="Board" component={BoardScreen} options={{ title: '' }} />
      <Stack.Screen
        name="BoardSubmit"
        component={BoardSubmitScreen}
        options={{ title: '', presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
