import { DEMO_COLORS, solid } from '@/app/demo/colors'
import { makeComponent } from '@/app/demo/helpers'
import type { EditorStore } from '@/app/editor/session'

/**
 * A small but real component library: Button (primary/secondary), Badge,
 * Avatar, Nav item, and Toggle — all as actual COMPONENTs. The app screen is
 * then assembled from INSTANCEs so the demo exercises the component → instance
 * → override workflow.
 */
export function createComponentsSection(store: EditorStore) {
  const { graph } = store

  const sectionId = store.createShape('SECTION', 60, 60, 660, 300)
  graph.updateNode(sectionId, {
    name: 'Component Library',
    fills: [solid(DEMO_COLORS.surface)]
  })

  const title = store.createShape('TEXT', 24, 20, 300, 20, sectionId)
  graph.updateNode(title, {
    name: 'Title',
    text: 'Components — the app below is built from these',
    fontSize: 12,
    fontWeight: 600,
    fills: [solid(DEMO_COLORS.textTertiary)],
    textAutoResize: 'WIDTH_AND_HEIGHT'
  })

  function caption(text: string, x: number, y: number) {
    const c = store.createShape('TEXT', x, y, 140, 14, sectionId)
    graph.updateNode(c, {
      name: 'Caption',
      text,
      fontSize: 10,
      fontWeight: 500,
      textAutoResize: 'WIDTH_AND_HEIGHT',
      fills: [solid(DEMO_COLORS.textTertiary)]
    })
  }

  caption('Button / Primary', 24, 52)
  caption('Button / Secondary', 156, 52)
  caption('Badge', 296, 52)
  caption('Avatar', 388, 52)
  caption('Nav item', 24, 148)
  caption('Toggle', 196, 148)

  // ── Button / Primary ──────────────────────────────────────────────
  const btnPrimary = store.createShape('FRAME', 24, 72, 116, 36, sectionId)
  graph.updateNode(btnPrimary, {
    name: 'Button / Primary',
    cornerRadius: 8,
    fills: [solid(DEMO_COLORS.accent)],
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    primaryAxisAlign: 'CENTER',
    counterAxisAlign: 'CENTER',
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 16,
    paddingRight: 16
  })
  const btnPrimaryLabel = store.createShape('TEXT', 0, 0, 84, 20, btnPrimary)
  graph.updateNode(btnPrimaryLabel, {
    name: 'Label',
    text: 'Get started',
    fontSize: 13,
    fontWeight: 600,
    textAutoResize: 'WIDTH_AND_HEIGHT',
    fills: [solid(DEMO_COLORS.white)]
  })
  const btnPrimaryComp = makeComponent(store, [btnPrimary])

  // ── Button / Secondary ────────────────────────────────────────────
  const btnSecondary = store.createShape('FRAME', 156, 72, 104, 36, sectionId)
  graph.updateNode(btnSecondary, {
    name: 'Button / Secondary',
    cornerRadius: 8,
    fills: [solid(DEMO_COLORS.surfaceSunken)],
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    primaryAxisAlign: 'CENTER',
    counterAxisAlign: 'CENTER',
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 16,
    paddingRight: 16
  })
  const btnSecondaryLabel = store.createShape('TEXT', 0, 0, 72, 20, btnSecondary)
  graph.updateNode(btnSecondaryLabel, {
    name: 'Label',
    text: 'Cancel',
    fontSize: 13,
    fontWeight: 600,
    textAutoResize: 'WIDTH_AND_HEIGHT',
    fills: [solid(DEMO_COLORS.textPrimary)]
  })
  const btnSecondaryComp = makeComponent(store, [btnSecondary])

  // ── Badge / Success ───────────────────────────────────────────────
  const badge = store.createShape('FRAME', 296, 72, 72, 24, sectionId)
  graph.updateNode(badge, {
    name: 'Badge / Success',
    cornerRadius: 12,
    fills: [solid(DEMO_COLORS.successSoft)],
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    primaryAxisAlign: 'CENTER',
    counterAxisAlign: 'CENTER',
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 8,
    paddingRight: 8
  })
  const badgeLabel = store.createShape('TEXT', 0, 0, 56, 16, badge)
  graph.updateNode(badgeLabel, {
    name: 'Label',
    text: '+14%',
    fontSize: 11,
    fontWeight: 600,
    textAutoResize: 'WIDTH_AND_HEIGHT',
    fills: [solid(DEMO_COLORS.success)]
  })
  const badgeComp = makeComponent(store, [badge])

  // ── Avatar ────────────────────────────────────────────────────────
  const avatar = store.createShape('ELLIPSE', 388, 72, 32, 32, sectionId)
  graph.updateNode(avatar, {
    name: 'Avatar',
    fills: [solid(DEMO_COLORS.accentSoft)]
  })
  const avatarComp = makeComponent(store, [avatar])

  // ── Nav item ──────────────────────────────────────────────────────
  const navItem = store.createShape('FRAME', 24, 168, 148, 32, sectionId)
  graph.updateNode(navItem, {
    name: 'Nav Item',
    cornerRadius: 6,
    fills: [solid(DEMO_COLORS.surfaceSunken)],
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    counterAxisAlign: 'CENTER',
    itemSpacing: 10,
    paddingLeft: 10,
    paddingRight: 10
  })
  const navDot = store.createShape('ELLIPSE', 0, 0, 14, 14, navItem)
  graph.updateNode(navDot, {
    name: 'Icon',
    fills: [solid(DEMO_COLORS.accent)]
  })
  const navLabel = store.createShape('TEXT', 0, 0, 80, 16, navItem)
  graph.updateNode(navLabel, {
    name: 'Label',
    text: 'Overview',
    fontSize: 13,
    fontWeight: 500,
    textAutoResize: 'WIDTH_AND_HEIGHT',
    fills: [solid(DEMO_COLORS.textPrimary)]
  })
  const navItemComp = makeComponent(store, [navItem])

  // ── Toggle ────────────────────────────────────────────────────────
  const toggle = store.createShape('FRAME', 196, 172, 36, 20, sectionId)
  graph.updateNode(toggle, {
    name: 'Toggle',
    cornerRadius: 10,
    fills: [solid(DEMO_COLORS.accent)]
  })
  const toggleKnob = store.createShape('ELLIPSE', 18, 2, 16, 16, toggle)
  graph.updateNode(toggleKnob, {
    name: 'Knob',
    fills: [solid(DEMO_COLORS.white)]
  })
  const toggleComp = makeComponent(store, [toggle])

  return {
    sectionId,
    btnPrimaryComp,
    btnSecondaryComp,
    badgeComp,
    avatarComp,
    navItemComp,
    toggleComp
  }
}
