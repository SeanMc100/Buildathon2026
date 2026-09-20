import { Linking, Platform } from 'react-native';

/**
 * Opens a link that leaves the app. On the web that must be a new tab, or
 * the visitor loses their place; Linking.openURL would replace the page.
 */
export function openExternal(url: string): void {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  Linking.openURL(url).catch(() => {
    // Nothing on the device can open this link; there is nothing useful to tell the user.
  });
}
