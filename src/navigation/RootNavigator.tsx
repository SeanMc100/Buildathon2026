import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';

import { BoardScreen } from '../screens/BoardScreen';
import { BoardSubmitScreen } from '../screens/BoardSubmitScreen';
import { BoardsScreen } from '../screens/BoardsScreen';
import { EventsScreen } from '../screens/EventsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { IntakeIntroScreen } from '../screens/IntakeIntroScreen';
import { IntakeQuestionScreen } from '../screens/IntakeQuestionScreen';
import { OpportunityDetailScreen } from '../screens/OpportunityDetailScreen';
import { OpportunityListScreen } from '../screens/OpportunityListScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ResultsScreen } from '../screens/ResultsScreen';
import { ResumesScreen } from '../screens/ResumesScreen';
import { SavedScreen } from '../screens/SavedScreen';
import { SupportScreen } from '../screens/SupportScreen';
import { TopBar } from '../web/TopBar';
import { withFrame } from '../web/layout';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Forms, the profile, a detail page and chat read best in a narrow column; card
// lists use the full width and turn into a grid; Home centres itself.
// See src/web/layout.tsx.
const Home = withFrame(HomeScreen, 'full');
const IntakeIntro = withFrame(IntakeIntroScreen, 'reading');
const IntakeQuestion = withFrame(IntakeQuestionScreen, 'reading');
const Profile = withFrame(ProfileScreen, 'reading');
const Results = withFrame(ResultsScreen, 'browse');
const Events = withFrame(EventsScreen, 'browse');
const OpportunityList = withFrame(OpportunityListScreen, 'browse');
const OpportunityDetail = withFrame(OpportunityDetailScreen, 'reading');
const Saved = withFrame(SavedScreen, 'browse');
const Boards = withFrame(BoardsScreen, 'reading');
const Board = withFrame(BoardScreen, 'reading');
const BoardSubmit = withFrame(BoardSubmitScreen, 'reading');
const Resumes = withFrame(ResumesScreen, 'reading');
const Support = withFrame(SupportScreen, 'reading');

// Sean owns this file. To add a screen, build it in src/screens/ and ask
// Sean to register it here and in ./types.ts.
export function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      // The web gets its own header with section links; native keeps the stack header.
      screenOptions={Platform.OS === 'web' ? { header: (props) => <TopBar {...props} /> } : undefined}
    >
      <Stack.Screen name="Home" component={Home} options={{ title: 'Home' }} />
      <Stack.Screen
        name="IntakeIntro"
        component={IntakeIntro}
        options={{ title: 'Career intake' }}
      />
      <Stack.Screen
        name="IntakeQuestion"
        component={IntakeQuestion}
        options={{ title: '', headerBackTitle: 'Exit' }}
      />
      {/* The screens render their own large titles, so the header stays blank. */}
      <Stack.Screen name="Profile" component={Profile} options={{ title: '' }} />
      <Stack.Screen name="Results" component={Results} options={{ title: '' }} />
      <Stack.Screen name="Events" component={Events} options={{ title: '' }} />
      <Stack.Screen name="OpportunityList" component={OpportunityList} options={{ title: '' }} />
      <Stack.Screen
        name="OpportunityDetail"
        component={OpportunityDetail}
        options={{ title: '' }}
      />
      <Stack.Screen name="Saved" component={Saved} options={{ title: '' }} />
      <Stack.Screen name="Boards" component={Boards} options={{ title: '' }} />
      {/* BoardScreen sets its own title from the board name. */}
      <Stack.Screen name="Board" component={Board} options={{ title: '' }} />
      <Stack.Screen
        name="BoardSubmit"
        component={BoardSubmit}
        options={{ title: '', presentation: 'modal' }}
      />
      <Stack.Screen name="Resumes" component={Resumes} options={{ title: '' }} />
      <Stack.Screen name="Support" component={Support} options={{ title: '' }} />
    </Stack.Navigator>
  );
}
