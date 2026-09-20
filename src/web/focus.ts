// Keyboard focus, drawn by us rather than by the browser. Sean owns this folder.
//
// The browser's default outline is a hairline drawn tight against the text, which
// on a 14px link is almost invisible and on a rounded card cuts the corners off.
// We suppress it and paint a ring that follows the element's own radius instead.

import type { PressableStateCallbackType, ViewStyle } from 'react-native';

import { colors } from '../theme';

/**
 * True while the element has keyboard focus. react-native-web reports it on the
 * Pressable state; React Native's own types don't declare it, and on a phone it
 * is simply always false.
 */
export function isFocused(state: PressableStateCallbackType): boolean {
  return (state as { focused?: boolean }).focused === true;
}

// `outlineStyle` is a react-native-web style property that React Native's types
// do not know about, so the object is widened once here rather than at each use.
const RING: Record<string, unknown> = {
  outlineStyle: 'none',
  boxShadow: `0 0 0 3px ${colors.background}, 0 0 0 5px ${colors.primary}`,
};

/** Apply alongside `isFocused(state)` in a Pressable's style function. */
export const focusRing = RING as ViewStyle;
