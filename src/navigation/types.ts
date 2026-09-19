// Every screen registered in RootNavigator needs an entry here.
// `undefined` means the route takes no params.
export type RootStackParamList = {
  Home: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
