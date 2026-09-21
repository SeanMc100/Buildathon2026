// The header for the web build: brand, a way back, and the main sections as
// links (so they can be opened in a new tab). Replaces the native stack header,
// which shows a blank title on most screens. Sean owns this folder.
//
// Four primary destinations, and a quieter group on the right for the things
// about you rather than about the catalog. The whole set fits inline on a real
// laptop; only a genuinely narrow window folds it into a menu.

import { Link } from '@react-navigation/native';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { useIntake } from '../intake';
import { useSaved } from '../saved';
import type { RootStackParamList } from '../navigation/types';
import { TOUCH_TARGET, colors, radius, shadow, spacing, typography } from '../theme';
import { focusRing, isFocused } from './focus';
import { isHovered } from './hover';

type RouteLike = { name: string; params?: object };

type Section = {
  label: string;
  screen: keyof RootStackParamList;
  /** Matches and Profile mean nothing until the questionnaire has been answered. */
  needsProfile: boolean;
  /** Whether the current route sits inside this section. */
  isActive: (route: RouteLike) => boolean;
};

const onScreens =
  (...names: (keyof RootStackParamList)[]) =>
  (route: RouteLike) =>
    names.includes(route.name as keyof RootStackParamList);

/** The catalog and the community: what the app is for. */
const PRIMARY: Section[] = [
  { label: 'Matches', screen: 'Results', needsProfile: true, isActive: onScreens('Results') },
  {
    label: 'Browse',
    screen: 'OpportunityList',
    needsProfile: false,
    isActive: onScreens('OpportunityList', 'OpportunityDetail'),
  },
  { label: 'Events', screen: 'Events', needsProfile: false, isActive: onScreens('Events') },
  {
    label: 'Boards',
    screen: 'Boards',
    needsProfile: false,
    isActive: onScreens('Boards', 'Board', 'BoardSubmit'),
  },
];

/** About you: quieter, and to the right of the divider. */
const SECONDARY: Section[] = [
  { label: 'Saved', screen: 'Saved', needsProfile: false, isActive: onScreens('Saved') },
  { label: 'Profile', screen: 'Profile', needsProfile: true, isActive: onScreens('Profile') },
  { label: 'Support', screen: 'Support', needsProfile: false, isActive: onScreens('Support') },
];

/**
 * Below this the two groups stop fitting on one line. Seven short links need
 * far less room than the ten this replaced, so a 13" laptop keeps its nav
 * instead of being handed a menu button.
 */
const INLINE_MIN_WIDTH = 900;
const BAR_MAX_WIDTH = 1280;

function SectionLink({
  section,
  route,
  menu,
  badge,
}: {
  section: Section;
  route: RouteLike;
  menu: boolean;
  badge?: number;
}) {
  const active = section.isActive(route);
  const label = badge ? `${section.label} (${badge})` : section.label;
  return (
    <Link
      screen={section.screen as 'Results'}
      style={[styles.link, menu && styles.menuLink, active && styles.linkActive]}
      aria-current={active ? 'page' : undefined}
    >
      {label}
    </Link>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <View style={styles.menuIcon}>
      <View style={[styles.menuBar, open && styles.menuBarTop]} />
      <View style={[styles.menuBar, open && styles.menuBarHidden]} />
      <View style={[styles.menuBar, open && styles.menuBarBottom]} />
    </View>
  );
}

export function TopBar({ navigation, route, back }: NativeStackHeaderProps) {
  const { width } = useWindowDimensions();
  const { profile } = useIntake();
  const { count } = useSaved();
  const [open, setOpen] = useState(false);
  const inline = width >= INLINE_MIN_WIDTH;

  const visible = (sections: Section[]) =>
    sections.filter((section) => profile || !section.needsProfile);
  const primary = visible(PRIMARY);
  const secondary = visible(SECONDARY);

  // Following a link, or going back, closes the menu.
  const location = `${route.key}:${JSON.stringify(route.params ?? null)}`;
  useEffect(() => setOpen(false), [location, inline]);

  const badgeFor = (section: Section) => (section.screen === 'Saved' ? count : undefined);

  return (
    <View style={styles.bar}>
      <View style={[styles.inner, { maxWidth: BAR_MAX_WIDTH }]}>
        <View style={styles.left}>
          {back ? (
            <Pressable
              onPress={navigation.goBack}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={(state) => [
                styles.back,
                isHovered(state) && styles.iconHover,
                isFocused(state) && focusRing,
              ]}
            >
              <Text style={styles.backText}>‹</Text>
            </Pressable>
          ) : null}
          <Link screen="Home" accessibilityLabel="Day 1 Detroit home">
            <View style={styles.brand}>
              <Image
                source={require('../../assets/logo-mark.png')}
                style={styles.logo}
                accessibilityIgnoresInvertColors
              />
              <Text style={styles.brandText}>Day 1 Detroit</Text>
            </View>
          </Link>
        </View>

        {inline ? (
          <View style={styles.links} accessibilityRole="menubar">
            {primary.map((section) => (
              <SectionLink key={section.label} section={section} route={route} menu={false} />
            ))}
            <View style={styles.divider} />
            {secondary.map((section) => (
              <SectionLink
                key={section.label}
                section={section}
                route={route}
                menu={false}
                badge={badgeFor(section)}
              />
            ))}
          </View>
        ) : (
          <Pressable
            onPress={() => setOpen((value) => !value)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={open ? 'Close menu' : 'Open menu'}
            accessibilityState={{ expanded: open }}
            style={(state) => [
              styles.menuButton,
              (open || isHovered(state)) && styles.iconHover,
              isFocused(state) && focusRing,
            ]}
          >
            <MenuIcon open={open} />
          </Pressable>
        )}
      </View>

      {open && !inline ? (
        <>
          {/* Catches a click anywhere below the bar, so the menu closes like a dropdown. */}
          <Pressable
            style={styles.backdrop}
            onPress={() => setOpen(false)}
            accessibilityLabel="Close menu"
            accessibilityRole="button"
          />
          <View style={styles.panel}>
            <View style={[styles.panelInner, { maxWidth: BAR_MAX_WIDTH }]} accessibilityRole="menu">
              {primary.map((section) => (
                <SectionLink key={section.label} section={section} route={route} menu />
              ))}
              <View style={styles.menuDivider} />
              {secondary.map((section) => (
                <SectionLink
                  key={section.label}
                  section={section}
                  route={route}
                  menu
                  badge={badgeFor(section)}
                />
              ))}
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Sits above the screen below it, or the dropdown would slide underneath.
  bar: {
    position: 'relative',
    zIndex: 20,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  inner: {
    width: '100%',
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  back: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  iconHover: { backgroundColor: colors.surface },
  backText: { fontSize: 28, lineHeight: 30, color: colors.text },

  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logo: { width: 42, height: 28 },
  brandText: { ...typography.heading, color: colors.primary },

  links: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, flexShrink: 1 },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  link: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textMuted,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm + 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  linkActive: { color: colors.primary, backgroundColor: colors.primarySoft },

  menuButton: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.sm,
  },
  menuIcon: { width: 20, height: 14, justifyContent: 'space-between' },
  menuBar: { height: 2, borderRadius: 1, backgroundColor: colors.text },
  // Turns the three bars into a cross while the menu is open.
  menuBarTop: { transform: [{ translateY: 6 }, { rotate: '45deg' }] },
  menuBarHidden: { opacity: 0 },
  menuBarBottom: { transform: [{ translateY: -6 }, { rotate: '-45deg' }] },

  backdrop: { position: 'absolute', top: '100%', left: 0, right: 0, height: 4000 },
  panel: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadow.lg,
  },
  panelInner: {
    width: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
    marginHorizontal: spacing.md,
  },
  menuLink: {
    ...typography.body,
    fontWeight: '600',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
});
