import type { PressableStateCallbackType } from 'react-native';

/**
 * True while a mouse is over a Pressable. react-native-web reports it on the
 * Pressable state; React Native's own types don't declare it, and on a phone
 * it is simply always false.
 */
export function isHovered(state: PressableStateCallbackType): boolean {
  return (state as { hovered?: boolean }).hovered === true;
}
