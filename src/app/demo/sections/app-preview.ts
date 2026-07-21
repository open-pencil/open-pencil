import type { Color } from '@open-pencil/scene-graph'

import { DEMO_COLORS, gradient, solid, thinStroke } from '@/app/demo/colors'
import type { EditorStore } from '@/app/editor/session'

interface DemoComponents {
  btnPrimaryComp: string
  btnSecondaryComp: string
  badgeComp: string
  avatarComp: string
  navItemComp: string
  toggleComp: string
}

type StatTone = 'success' | 'accent' | 'danger'

const STAT_TONE_COLORS: Record<StatTone, { foreground: Color; background: Color }> = {
  success: { foreground: DEMO_COLORS.success, background: DEMO_COLORS.successSoft },
  accent: { foreground: DEMO_COLORS.accent, background: DEMO_COLORS.accentSoft },
  danger: { foreground: DEMO_COLORS.danger, background: DEMO_COLORS.dangerSoft }
}

/**
 * One cohesive product screen assembled from INSTANCEs of the component
 * library, laid out with real auto-layout, and themed via bound variables.
 * Resizing the root frame demonstrates live reflow; toggling a variable
 * re-themes the whole screen.
 */
export function createAppPreviewSection(store: EditorStore, comps: DemoComponents) {
  const { graph } = store

  const sectionId = store.createShape('SECTION', 760, 60, 720, 760)
  graph.updateNode(sectionId, {
    name: 'App — Analytics',
    fills: [solid(DEMO_COLORS.bg)]
  })

  // ── Sidebar ───────────────────────────────────────────────────────
  const sidebar = store.createShape('FRAME', 24, 24, 180, 712, sectionId)
  graph.updateNode(sidebar, {
    name: 'Sidebar',
    cornerRadius: 16,
    fills: [solid(DEMO_COLORS.surface)],
    strokes: thinStroke(DEMO_COLORS.border),
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    itemSpacing: 4,
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 12,
    paddingRight: 12
  })

  const logo = store.createShape('FRAME', 0, 0, 156, 32, sidebar)
  graph.updateNode(logo, {
    name: 'Logo',
    fills: [],
    layoutMode: 'HORIZONTAL',
    counterAxisAlign: 'CENTER',
    itemSpacing: 8,
    paddingLeft: 8
  })
  const logoMark = store.createShape('ELLIPSE', 0, 0, 18, 18, logo)
  graph.updateNode(logoMark, { name: 'Mark', fills: [solid(DEMO_COLORS.accent)] })
  const logoText = store.createShape('TEXT', 0, 0, 90, 18, logo)
  graph.updateNode(logoText, {
    name: 'Wordmark',
    text: 'Pulse',
    fontSize: 15,
    fontWeight: 700,
    textAutoResize: 'WIDTH_AND_HEIGHT',
    fills: [solid(DEMO_COLORS.textPrimary)]
  })

  const navLabels = ['Overview', 'Analytics', 'Customers', 'Reports', 'Settings']
  navLabels.forEach((label, i) => {
    const inst = graph.createInstance(comps.navItemComp, sidebar)
    if (inst) {
      graph.updateNode(inst.id, { name: `Nav / ${label}` })
      const labelChild = inst.childIds
        .map((cid) => graph.getNode(cid))
        .find((n) => n?.type === 'TEXT')
      if (labelChild) {
        // Set the text and record an override so component sync doesn't revert it.
        graph.updateNode(labelChild.id, { text: label })
        graph.updateNode(inst.id, {
          overrides: { ...inst.overrides, [`${labelChild.id}:text`]: label }
        })
      }
      if (i === 0) {
        const dotChild = inst.childIds
          .map((cid) => graph.getNode(cid))
          .find((n) => n?.type === 'ELLIPSE')
        if (dotChild) graph.updateNode(dotChild.id, { fills: [solid(DEMO_COLORS.accent)] })
      }
    }
  })

  // ── Main content (auto-layout column) ─────────────────────────────
  const main = store.createShape('FRAME', 224, 24, 472, 712, sectionId)
  graph.updateNode(main, {
    name: 'Content',
    fills: [],
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    itemSpacing: 16
  })

  // Header
  const header = store.createShape('FRAME', 0, 0, 472, 40, main)
  graph.updateNode(header, {
    name: 'Header',
    fills: [],
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    primaryAxisAlign: 'SPACE_BETWEEN',
    counterAxisAlign: 'CENTER'
  })
  const headerTitleWrap = store.createShape('FRAME', 0, 0, 200, 40, header)
  graph.updateNode(headerTitleWrap, {
    name: 'Title',
    fills: [],
    layoutMode: 'VERTICAL',
    itemSpacing: 2
  })
  const headerTitle = store.createShape('TEXT', 0, 0, 140, 22, headerTitleWrap)
  graph.updateNode(headerTitle, {
    name: 'Heading',
    text: 'Analytics overview',
    fontSize: 18,
    fontWeight: 700,
    textAutoResize: 'WIDTH_AND_HEIGHT',
    fills: [solid(DEMO_COLORS.textPrimary)]
  })
  const headerSub = store.createShape('TEXT', 0, 0, 200, 16, headerTitleWrap)
  graph.updateNode(headerSub, {
    name: 'Subheading',
    text: 'Last 30 days',
    fontSize: 12,
    fontWeight: 400,
    textAutoResize: 'WIDTH_AND_HEIGHT',
    fills: [solid(DEMO_COLORS.textSecondary)]
  })
  graph.createInstance(comps.avatarComp, header)
  graph.createInstance(comps.btnPrimaryComp, header)

  // Stat row (auto-layout, fills width)
  const statRow = store.createShape('FRAME', 0, 0, 472, 96, main)
  graph.updateNode(statRow, {
    name: 'Stat Row',
    fills: [],
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    itemSpacing: 12
  })

  const stats = [
    { title: 'Revenue', value: '$12,480', trend: '+14%', tone: 'success' as const },
    { title: 'Active users', value: '3,842', trend: '+8%', tone: 'accent' as const },
    { title: 'Churn', value: '1.9%', trend: '-3%', tone: 'danger' as const }
  ]

  const statBadges: StatBadge[] = []
  stats.forEach((s) => {
    const card = store.createShape('FRAME', 0, 0, 148, 96, statRow)
    graph.updateNode(card, {
      name: `Stat / ${s.title}`,
      cornerRadius: 12,
      fills: [solid(DEMO_COLORS.surface)],
      strokes: thinStroke(DEMO_COLORS.border),
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FILL',
      itemSpacing: 6,
      paddingTop: 14,
      paddingBottom: 14,
      paddingLeft: 16,
      paddingRight: 16
    })
    const label = store.createShape('TEXT', 0, 0, 100, 14, card)
    graph.updateNode(label, {
      name: 'Label',
      text: s.title,
      fontSize: 12,
      fontWeight: 500,
      textAutoResize: 'HEIGHT',
      layoutAlignSelf: 'STRETCH',
      fills: [solid(DEMO_COLORS.textSecondary)]
    })
    const value = store.createShape('TEXT', 0, 0, 100, 26, card)
    graph.updateNode(value, {
      name: 'Value',
      text: s.value,
      fontSize: 22,
      fontWeight: 700,
      textAutoResize: 'HEIGHT',
      layoutAlignSelf: 'STRETCH',
      fills: [solid(DEMO_COLORS.textPrimary)]
    })
    const badge = graph.createInstance(comps.badgeComp, card)
    if (badge) {
      const tone = STAT_TONE_COLORS[s.tone]
      const bLabel = badge.childIds.map((cid) => graph.getNode(cid)).find((n) => n?.type === 'TEXT')
      if (bLabel) {
        const overrides: Record<string, unknown> = { ...badge.overrides }
        graph.updateNode(bLabel.id, { text: s.trend, fills: [solid(tone.foreground)] })
        overrides[`${bLabel.id}:text`] = s.trend
        overrides[`${bLabel.id}:fills`] = [solid(tone.foreground)]
        graph.updateNode(badge.id, { fills: [solid(tone.background)], overrides })
        statBadges.push({ id: badge.id, labelId: bLabel.id, tone: s.tone })
      }
    }
  })

  // Chart card
  const chart = store.createShape('FRAME', 0, 0, 472, 260, main)
  graph.updateNode(chart, {
    name: 'Chart',
    cornerRadius: 12,
    fills: [solid(DEMO_COLORS.surface)],
    strokes: thinStroke(DEMO_COLORS.border),
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 16,
    paddingRight: 16,
    itemSpacing: 12
  })
  const chartHeader = store.createShape('FRAME', 0, 0, 440, 20, chart)
  graph.updateNode(chartHeader, {
    name: 'Chart Header',
    fills: [],
    layoutMode: 'HORIZONTAL',
    primaryAxisAlign: 'SPACE_BETWEEN',
    counterAxisAlign: 'CENTER'
  })
  const chartTitle = store.createShape('TEXT', 0, 0, 140, 18, chartHeader)
  graph.updateNode(chartTitle, {
    name: 'Title',
    text: 'Revenue over time',
    fontSize: 13,
    fontWeight: 600,
    textAutoResize: 'WIDTH_AND_HEIGHT',
    fills: [solid(DEMO_COLORS.textPrimary)]
  })
  graph.createInstance(comps.toggleComp, chartHeader)

  const bars = store.createShape('FRAME', 0, 0, 440, 190, chart)
  graph.updateNode(bars, {
    name: 'Bars',
    fills: [],
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    primaryAxisAlign: 'SPACE_BETWEEN',
    counterAxisAlign: 'MAX',
    paddingTop: 8
  })
  const barHeights = [70, 105, 88, 128, 96, 148, 112, 84, 132, 158, 120, 92]
  barHeights.forEach((h, i) => {
    const bar = store.createShape('RECTANGLE', 0, 0, 22, h, bars)
    graph.updateNode(bar, {
      name: `Bar ${i + 1}`,
      cornerRadius: 5,
      fills: [
        gradient([
          { color: DEMO_COLORS.accent, position: 0 },
          { color: { r: 0.55, g: 0.5, b: 0.98, a: 1 }, position: 1 }
        ])
      ]
    })
  })

  // Feature callout
  const callout = store.createShape('FRAME', 0, 0, 472, 64, main)
  graph.updateNode(callout, {
    name: 'Callout',
    cornerRadius: 12,
    fills: [solid(DEMO_COLORS.accentSoft)],
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    counterAxisAlign: 'CENTER',
    itemSpacing: 12,
    paddingLeft: 16,
    paddingRight: 16
  })
  const calloutDot = store.createShape('ELLIPSE', 0, 0, 24, 24, callout)
  graph.updateNode(calloutDot, { name: 'Icon', fills: [solid(DEMO_COLORS.accent)] })
  const calloutText = store.createShape('TEXT', 0, 0, 340, 32, callout)
  graph.updateNode(calloutText, {
    name: 'Text',
    text: 'This screen is built from components, auto-layout, and variables. Edit a variable to re-theme it.',
    fontSize: 12,
    fontWeight: 500,
    textAutoResize: 'HEIGHT',
    layoutAlignSelf: 'STRETCH',
    fills: [solid(DEMO_COLORS.accentText)]
  })

  return { sectionId, sidebar, main, headerTitle, chartTitle, statBadges }
}

interface StatBadge {
  id: string
  labelId: string
  tone: StatTone
}
