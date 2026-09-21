// Responsive layout for wide screens: the browser, and iPads. Phones keep the
// layout the screens were designed for, because the frame only bites once the
// window is wider than the column it holds. Sean owns this folder.

import { createContext, useContext, type ComponentType } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import { colors } from '../theme';

/** Window widths at which the layout steps up. */
export const BREAKPOINTS = { tablet: 640, desktop: 1024 } as const;

/**
 * How wide a screen's column may grow.
 * `reading` suits forms, the profile and chat; `browse` suits card grids;
 * `full` never constrains, for pages that lay themselves out edge to edge.
 */
export const FRAME_WIDTH = { reading: 680, browse: 1120, full: Infinity } as const;
export type Frame = keyof typeof FRAME_WIDTH;

/** Side padding every screen already uses (theme spacing.lg). */
const GUTTER = 24;
/** Gap between cards in a grid. */
export const GRID_GAP = 16;

export type Layout = {
  /** Usable width of the column the current screen renders in, scrollbar excluded. */
  width: number;
  /** Window narrower than a tablet: the phone layout. */
  isCompact: boolean;
  /** How many cards fit side by side. Always 1 in a reading column. */
  columns: 1 | 2 | 3;
  /** Width of one card when the grid uses `columns`, gutters and gaps included. */
  cardWidth: number;
};

let measuredScrollbar: number | undefined;

/**
 * Width the browser reserves for a vertical scrollbar (15px or so with a mouse
 * on Windows, 0 with overlay scrollbars on macOS and phones). The window width
 * includes it, but a scrolling screen cannot use it, so a grid sized to the
 * window would wrap its last column onto a new row.
 */
function scrollbarWidth(): number {
  if (measuredScrollbar !== undefined) return measuredScrollbar;
  measuredScrollbar = 0;
  if (Platform.OS === 'web' && typeof document !== 'undefined' && document.body) {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll';
    document.body.appendChild(probe);
    measuredScrollbar = probe.offsetWidth - probe.clientWidth;
    document.body.removeChild(probe);
  }
  return measuredScrollbar;
}

function columnsFor(frame: Frame, width: number): 1 | 2 | 3 {
  if (frame === 'reading') return 1;
  if (width >= 960) return 3;
  if (width >= BREAKPOINTS.tablet) return 2;
  return 1;
}

/** The framed column's 1px border either side (columnFramed). */
const FRAME_BORDER = 2;
/**
 * Room left over in every grid row. The container's real width can come out a
 * pixel or two under the arithmetic (borders, scrollbar, rounding at a zoomed
 * page), and a row sized to the pixel then drops its last card onto a new row.
 */
const GRID_SLACK = 12;

function layoutFor(frame: Frame, windowWidth: number): Layout {
  const framed = windowWidth > FRAME_WIDTH[frame];
  const width =
    Math.min(windowWidth, FRAME_WIDTH[frame]) - scrollbarWidth() - (framed ? FRAME_BORDER : 0);
  const columns = columnsFor(frame, width);
  const slack = columns > 1 ? GRID_SLACK : 0;
  const cardWidth = Math.floor(
    (width - GUTTER * 2 - GRID_GAP * (columns - 1) - slack) / columns,
  );
  return { width, isCompact: windowWidth < BREAKPOINTS.tablet, columns, cardWidth };
}

const LayoutContext = createContext<Layout>(layoutFor('reading', 390));

/** The layout of the screen this is called from. */
export function useLayout(): Layout {
  return useContext(LayoutContext);
}

/** Window-level breakpoint, for chrome that sits outside any screen (the top bar). */
export function useIsCompact(): boolean {
  return useWindowDimensions().width < BREAKPOINTS.tablet;
}

/** Centres a screen in a column and tells it how wide that column is. */
export function ScreenFrame({ frame, children }: { frame: Frame; children: React.ReactNode }) {
  const { width: windowWidth } = useWindowDimensions();
  const layout = layoutFor(frame, windowWidth);
  const framed = windowWidth > FRAME_WIDTH[frame];

  return (
    <LayoutContext.Provider value={layout}>
      <View style={styles.page}>
        <View
          style={[
            styles.column,
            Number.isFinite(FRAME_WIDTH[frame]) && { maxWidth: FRAME_WIDTH[frame] },
            framed && styles.columnFramed,
          ]}
        >
          {children}
        </View>
      </View>
    </LayoutContext.Provider>
  );
}

/** Wraps a screen component so it renders inside a ScreenFrame. Call once, at module scope. */
export function withFrame<P extends object>(Screen: ComponentType<P>, frame: Frame): ComponentType<P> {
  function Framed(props: P) {
    return (
      <ScreenFrame frame={frame}>
        <Screen {...props} />
      </ScreenFrame>
    );
  }
  Framed.displayName = `Framed(${Screen.displayName ?? Screen.name})`;
  return Framed;
}

const styles = StyleSheet.create({
  // The gutters either side of the column are a shade darker than the column
  // itself, so a wide window reads as a page rather than as stretched content.
  page: { flex: 1, alignItems: 'center', backgroundColor: colors.surfaceSunken },
  column: { flex: 1, width: '100%', backgroundColor: colors.background },
  columnFramed: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border },
});
