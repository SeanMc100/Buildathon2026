// The header for the web build: brand, a way back, and the main sections as
// links (so they can be opened in a new tab). Replaces the native stack header,
// which shows a blank title on most screens. Wide windows show every section
// inline; anything narrower folds them into a menu. Sean owns this folder.

import { Link } from '@react-navigation/native';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { useIntake } from '../intake';
import type { ListKind, RootStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import { isHovered } from './hover';
import { useIsCompact } from './layout';

type RouteLike = { name: string; params?: object };

type Section = {
  label: string;
  screen: keyof RootStackParamList;
  params?: { kind: ListKind };
  /** Matches and Profile mean nothing until the questionnaire has been answered. */
  needsProfile: boolean;
  /** Whether the current route sits inside this section. */
  isActive: (route: RouteLike) => boolean;
};

const onScreens =
  (...names: (keyof RootStackParamList)[]) =>
  (route: RouteLike) =>
    names.includes(route.name as keyof RootStackParamList);

const onList = (kind: ListKind) => (route: RouteLike) =>
  route.name === 'OpportunityList' && (route.params as { kind?: ListKind } | undefined)?.kind === kind;

const SECTIONS: Section[] = [
  { label: 'Matches', screen: 'Results', needsProfile: true, isActive: onScreens('Results') },
  { label: 'Resumes', screen: 'Resumes', needsProfile: false, isActive: onScreens('Resumes') },
  { label: 'Jobs', screen: 'OpportunityList', params: { kind: 'job' }, needsProfile: false, isActive: onList('job') },
  {
    label: 'Internships',
    screen: 'OpportunityList',
    params: { kind: 'internship' },
    needsProfile: false,
    isActive: onList('internship'),
  },
  {
    label: 'Programs',
    screen: 'OpportunityList',
    params: { kind: 'program' },
    needsProfile: false,
    isActive: onList('program'),
  },
  {
    label: 'Research Programs',
    screen: 'OpportunityList',
    params: { kind: 'research' },
    needsProfile: false,
    isActive: onList('research'),
  },
  { label: 'Events', screen: 'Events', needsProfile: false, isActive: onScreens('Events') },
  {
    label: 'Bulletin Boards',
    screen: 'Boards',
    needsProfile: false,
    isActive: onScreens('Boards', 'Board', 'BoardSubmit'),
  },
  { label: 'Support', screen: 'Support', needsProfile: false, isActive: onScreens('Support') },
  { label: 'Profile', screen: 'Profile', needsProfile: true, isActive: onScreens('Profile') },
];

/** Below this window width the ten sections no longer fit on one line. */
const INLINE_MIN_WIDTH = 1200;
const BAR_MAX_WIDTH = 1280;

function SectionLink({ section, route, menu }: { section: Section; route: RouteLike; menu: boolean }) {
  const active = section.isActive(route);
  return (
    <Link
      screen={section.screen as 'Results'}
      params={section.params as never}
      style={[styles.link, menu && styles.menuLink, active && styles.linkActive]}
    >
      {section.label}
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
  const compact = useIsCompact();
  const { profile } = useIntake();
  const [open, setOpen] = useState(false);
  const inline = width >= INLINE_MIN_WIDTH;
  const sections = SECTIONS.filter((section) => profile || !section.needsProfile);

  // Following a link, or going back, closes the menu.
  const location = `${route.key}:${JSON.stringify(route.params ?? null)}`;
  useEffect(() => setOpen(false), [location, inline]);

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
              style={(state) => [styles.back, isHovered(state) && styles.backHover]}
            >
              <Text style={styles.backText}>‹</Text>
            </Pressable>
          ) : null}
          <Link screen="Home" style={styles.brand} accessibilityLabel="Buildathon App home">
            Buildathon App
          </Link>
        </View>

        {inline ? (
          <View style={styles.links} accessibilityRole="menu">
            {sections.map((section) => (
              <SectionLink key={section.label} section={section} route={route} menu={false} />
            ))}
          </View>
        ) : (
          <Pressable
            onPress={() => setOpen((value) => !value)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Menu"
            accessibilityState={{ expanded: open }}
            style={(state) => [styles.menuButton, (open || isHovered(state)) && styles.backHover]}
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
              {sections.map((section) => (
                <View key={section.label} style={compact ? styles.cellFull : styles.cellHalf}>
                  <SectionLink section={section} route={route} menu />
                </View>
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
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  back: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  backHover: { backgroundColor: colors.surface },
  backText: { fontSize: 28, lineHeight: 30, color: colors.text },

  brand: { ...typography.heading, color: colors.primary },

  links: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  link: {
    ...typography.caption,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  linkActive: { color: colors.primary, backgroundColor: colors.primarySoft },

  menuButton: {
    width: 40,
    height: 40,
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
    boxShadow: '0 12px 24px rgba(17, 17, 17, 0.08)',
  },
  panelInner: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cellFull: { width: '100%' },
  cellHalf: { width: '50%' },
  menuLink: {
    ...typography.body,
    fontWeight: '500',
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
});
