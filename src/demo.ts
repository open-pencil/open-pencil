import { computeAllLayouts } from './engine/layout'

import type { Color, Effect, Fill, GradientStop } from './engine/scene-graph'
import type { EditorStore } from './stores/editor'

const WHITE: Color = { r: 1, g: 1, b: 1, a: 1 }
const BLACK: Color = { r: 0, g: 0, b: 0, a: 1 }
const GRAY_50: Color = { r: 0.98, g: 0.98, b: 0.98, a: 1 }
const GRAY_100: Color = { r: 0.96, g: 0.96, b: 0.97, a: 1 }
const GRAY_200: Color = { r: 0.9, g: 0.9, b: 0.92, a: 1 }
const GRAY_500: Color = { r: 0.55, g: 0.55, b: 0.58, a: 1 }
const BLUE: Color = { r: 0.23, g: 0.51, b: 0.96, a: 1 }
const INDIGO: Color = { r: 0.38, g: 0.35, b: 0.95, a: 1 }
const PURPLE: Color = { r: 0.59, g: 0.28, b: 0.96, a: 1 }
const GREEN: Color = { r: 0.13, g: 0.77, b: 0.42, a: 1 }
const ORANGE: Color = { r: 0.96, g: 0.52, b: 0.13, a: 1 }
const RED: Color = { r: 0.91, g: 0.22, b: 0.22, a: 1 }
const TEAL: Color = { r: 0.08, g: 0.73, b: 0.73, a: 1 }

function solid(color: Color, opacity = 1): Fill {
  return { type: 'SOLID', color, opacity, visible: true }
}

function gradient(stops: GradientStop[]): Fill {
  return {
    type: 'GRADIENT_LINEAR',
    color: stops[0].color,
    opacity: 1,
    visible: true,
    gradientStops: stops,
    gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
  }
}

function thinStroke(color: Color) {
  return [{ color, weight: 1, opacity: 1, visible: true, align: 'INSIDE' as const }]
}

function makeComponent(store: EditorStore, ids: string[]): string {
  store.select(ids)
  store.createComponentFromSelection()
  return [...store.state.selectedIds][0]
}

export function createDemoShapes(store: EditorStore) {
  const { graph } = store

  // ─── Section: Components ──────────────────────────────────────
  const compSectionId = store.createShape('SECTION', 60, 60, 920, 540)
  graph.updateNode(compSectionId, { name: 'Components' })

  // Button component
  const btnId = store.createShape('FRAME', 32, 48, 120, 40, compSectionId)
  graph.updateNode(btnId, {
    name: 'Button/Primary',
    cornerRadius: 8,
    fills: [solid(BLUE)],
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    primaryAxisAlign: 'CENTER',
    counterAxisAlign: 'CENTER',
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 20,
    paddingRight: 20
  })
  const btnTextId = store.createShape('TEXT', 0, 0, 80, 20, btnId)
  graph.updateNode(btnTextId, {
    name: 'Label',
    text: 'Get Started',
    fontSize: 14,
    fontWeight: 600,
    fills: [solid(WHITE)]
  })
  const btnCompId = makeComponent(store, [btnId])

  // Secondary button
  const btn2Id = store.createShape('FRAME', 176, 48, 100, 40, compSectionId)
  graph.updateNode(btn2Id, {
    name: 'Button/Secondary',
    cornerRadius: 8,
    fills: [solid(WHITE)],
    strokes: thinStroke(GRAY_200),
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    primaryAxisAlign: 'CENTER',
    counterAxisAlign: 'CENTER',
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 20,
    paddingRight: 20
  })
  const btn2TextId = store.createShape('TEXT', 0, 0, 60, 20, btn2Id)
  graph.updateNode(btn2TextId, {
    name: 'Label',
    text: 'Cancel',
    fontSize: 14,
    fontWeight: 500,
    fills: [solid(BLACK)]
  })
  makeComponent(store, [btn2Id])

  // Chip / Tag component
  const chipId = store.createShape('FRAME', 304, 52, 80, 28, compSectionId)
  graph.updateNode(chipId, {
    name: 'Tag',
    cornerRadius: 14,
    fills: [solid({ r: 0.93, g: 0.94, b: 1, a: 1 })],
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    primaryAxisAlign: 'CENTER',
    counterAxisAlign: 'CENTER',
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 12,
    paddingRight: 12
  })
  const chipTextId = store.createShape('TEXT', 0, 0, 56, 16, chipId)
  graph.updateNode(chipTextId, {
    name: 'Label',
    text: 'Design',
    fontSize: 12,
    fontWeight: 500,
    fills: [solid(INDIGO)]
  })
  makeComponent(store, [chipId])

  // Avatar component
  const avatarId = store.createShape('ELLIPSE', 416, 48, 40, 40, compSectionId)
  graph.updateNode(avatarId, {
    name: 'Avatar',
    fills: [
      gradient([
        { color: PURPLE, position: 0 },
        { color: BLUE, position: 1 }
      ])
    ]
  })
  makeComponent(store, [avatarId])

  // Card component (auto layout)
  const cardId = store.createShape('FRAME', 32, 128, 280, 160, compSectionId)
  graph.updateNode(cardId, {
    name: 'Card',
    cornerRadius: 12,
    fills: [solid(WHITE)],
    strokes: thinStroke(GRAY_200),
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    itemSpacing: 8,
    paddingTop: 20,
    paddingBottom: 20,
    paddingLeft: 20,
    paddingRight: 20
  })
  const cardTitleId = store.createShape('TEXT', 0, 0, 240, 22, cardId)
  graph.updateNode(cardTitleId, {
    name: 'Title',
    text: 'Analytics Overview',
    fontSize: 16,
    fontWeight: 600,
    fills: [solid(BLACK)]
  })
  const cardDescId = store.createShape('TEXT', 0, 0, 240, 36, cardId)
  graph.updateNode(cardDescId, {
    name: 'Description',
    text: 'Track your key metrics and performance indicators in real time.',
    fontSize: 13,
    fontWeight: 400,
    fills: [solid(GRAY_500)]
  })
  const cardBarBg = store.createShape('RECTANGLE', 0, 0, 240, 8, cardId)
  graph.updateNode(cardBarBg, {
    name: 'Progress BG',
    cornerRadius: 4,
    fills: [solid(GRAY_100)]
  })
  const cardBar = store.createShape('RECTANGLE', 0, 0, 168, 8, cardId)
  graph.updateNode(cardBar, {
    name: 'Progress',
    cornerRadius: 4,
    fills: [
      gradient([
        { color: BLUE, position: 0 },
        { color: TEAL, position: 1 }
      ])
    ]
  })
  makeComponent(store, [cardId])

  // Input component
  const inputId = store.createShape('FRAME', 344, 128, 240, 40, compSectionId)
  graph.updateNode(inputId, {
    name: 'Input',
    cornerRadius: 8,
    fills: [solid(WHITE)],
    strokes: thinStroke(GRAY_200),
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'HUG',
    primaryAxisAlign: 'MIN',
    counterAxisAlign: 'CENTER',
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 12,
    paddingRight: 12
  })
  const inputPlaceholder = store.createShape('TEXT', 0, 0, 200, 18, inputId)
  graph.updateNode(inputPlaceholder, {
    name: 'Placeholder',
    text: 'Search...',
    fontSize: 14,
    fontWeight: 400,
    fills: [solid(GRAY_500)]
  })
  makeComponent(store, [inputId])

  // Badge component
  const badgeId = store.createShape('FRAME', 344, 196, 48, 24, compSectionId)
  graph.updateNode(badgeId, {
    name: 'Badge',
    cornerRadius: 12,
    fills: [solid({ r: 0.93, g: 1, b: 0.95, a: 1 })],
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    primaryAxisAlign: 'CENTER',
    counterAxisAlign: 'CENTER',
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 8,
    paddingRight: 8
  })
  const badgeDot = store.createShape('ELLIPSE', 0, 0, 6, 6, badgeId)
  graph.updateNode(badgeDot, {
    name: 'Dot',
    fills: [solid(GREEN)]
  })
  const badgeText = store.createShape('TEXT', 0, 0, 28, 14, badgeId)
  graph.updateNode(badgeText, {
    name: 'Label',
    text: 'Live',
    fontSize: 11,
    fontWeight: 600,
    fills: [solid(GREEN)]
  })
  const badgeCompId = makeComponent(store, [badgeId])

  // Color swatches row
  const swatches = [
    { name: 'Blue', color: BLUE, x: 32 },
    { name: 'Indigo', color: INDIGO, x: 88 },
    { name: 'Purple', color: PURPLE, x: 144 },
    { name: 'Green', color: GREEN, x: 200 },
    { name: 'Teal', color: TEAL, x: 256 },
    { name: 'Orange', color: ORANGE, x: 312 },
    { name: 'Red', color: RED, x: 368 }
  ]
  for (const s of swatches) {
    const id = store.createShape('ELLIPSE', s.x, 460, 44, 44, compSectionId)
    graph.updateNode(id, { name: s.name, fills: [solid(s.color)] })
  }

  // ─── Section: App Preview ─────────────────────────────────────
  const appSectionId = store.createShape('SECTION', 1040, 60, 560, 540)
  graph.updateNode(appSectionId, { name: 'App Preview' })

  // Desktop frame
  const frameId = store.createShape('FRAME', 20, 48, 520, 460, appSectionId)
  graph.updateNode(frameId, {
    name: 'Dashboard',
    fills: [solid(GRAY_50)],
    strokes: thinStroke(GRAY_200),
    clipsContent: true
  })

  // Sidebar
  const sidebarId = store.createShape('RECTANGLE', 0, 0, 56, 460, frameId)
  graph.updateNode(sidebarId, {
    name: 'Sidebar',
    fills: [solid(WHITE)],
    strokes: thinStroke(GRAY_200)
  })

  // Sidebar dots
  for (let i = 0; i < 5; i++) {
    const dotId = store.createShape('ELLIPSE', 18, 20 + i * 40, 20, 20, frameId)
    graph.updateNode(dotId, {
      name: `Nav ${i + 1}`,
      fills: [solid(i === 0 ? BLUE : GRAY_200)]
    })
  }

  // Header bar
  const headerId = store.createShape('RECTANGLE', 56, 0, 464, 52, frameId)
  graph.updateNode(headerId, {
    name: 'Header',
    fills: [solid(WHITE)],
    strokes: thinStroke(GRAY_200)
  })
  const headerTitle = store.createShape('TEXT', 76, 16, 120, 20, frameId)
  graph.updateNode(headerTitle, {
    name: 'Page Title',
    text: 'Dashboard',
    fontSize: 16,
    fontWeight: 600,
    fills: [solid(BLACK)]
  })

  // Button instance in the header
  const headerBtn = graph.createInstance(btnCompId, frameId, { x: 400, y: 8 })
  if (headerBtn) graph.updateNode(headerBtn.id, { x: 400, y: 8 })

  // Badge instance next to title
  const headerBadge = graph.createInstance(badgeCompId, frameId, { x: 200, y: 18 })
  if (headerBadge) graph.updateNode(headerBadge.id, { x: 200, y: 18 })

  // Stat cards row (instances from Card component, simulated as frames)
  const stats = [
    { title: 'Revenue', value: '$12,480', badge: '+14%', color: GREEN },
    { title: 'Users', value: '3,842', badge: '+8%', color: BLUE },
    { title: 'Orders', value: '1,249', badge: '-3%', color: RED }
  ]

  for (let i = 0; i < stats.length; i++) {
    const s = stats[i]
    const cx = 76 + i * 152
    const cId = store.createShape('FRAME', cx, 72, 140, 88, frameId)
    graph.updateNode(cId, {
      name: s.title,
      cornerRadius: 10,
      fills: [solid(WHITE)],
      strokes: thinStroke(GRAY_200),
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      itemSpacing: 4,
      paddingTop: 14,
      paddingBottom: 14,
      paddingLeft: 16,
      paddingRight: 16
    })
    const labelId = store.createShape('TEXT', 0, 0, 108, 14, cId)
    graph.updateNode(labelId, {
      name: 'Label',
      text: s.title,
      fontSize: 11,
      fontWeight: 500,
      fills: [solid(GRAY_500)]
    })
    const valId = store.createShape('TEXT', 0, 0, 108, 24, cId)
    graph.updateNode(valId, {
      name: 'Value',
      text: s.value,
      fontSize: 22,
      fontWeight: 700,
      fills: [solid(BLACK)]
    })
    const bId = store.createShape('TEXT', 0, 0, 108, 14, cId)
    graph.updateNode(bId, {
      name: 'Badge',
      text: s.badge,
      fontSize: 11,
      fontWeight: 600,
      fills: [solid(s.color)]
    })
  }

  // Chart area
  const chartBg = store.createShape('FRAME', 76, 180, 424, 200, frameId)
  graph.updateNode(chartBg, {
    name: 'Chart',
    cornerRadius: 10,
    fills: [solid(WHITE)],
    strokes: thinStroke(GRAY_200)
  })
  const chartTitle = store.createShape('TEXT', 16, 16, 120, 18, chartBg)
  graph.updateNode(chartTitle, {
    name: 'Chart Title',
    text: 'Revenue over time',
    fontSize: 13,
    fontWeight: 600,
    fills: [solid(BLACK)]
  })

  // Chart bars
  const barHeights = [60, 90, 72, 110, 95, 130, 100, 80, 120, 140, 115, 88]
  const barW = 24
  const barGap = 10
  const barStartX = 16
  const barBaseY = 180

  for (let i = 0; i < barHeights.length; i++) {
    const h = barHeights[i]
    const bx = barStartX + i * (barW + barGap)
    const by = barBaseY - h
    const barId = store.createShape('RECTANGLE', bx, by, barW, h, chartBg)
    graph.updateNode(barId, {
      name: `Bar ${i + 1}`,
      cornerRadius: 4,
      fills: [
        gradient([
          { color: BLUE, position: 0 },
          { color: INDIGO, position: 1 }
        ])
      ]
    })
  }

  // Table section
  const tableId = store.createShape('FRAME', 76, 400, 424, 40, frameId)
  graph.updateNode(tableId, {
    name: 'Table Header',
    fills: [solid(WHITE)],
    strokes: thinStroke(GRAY_200),
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'HUG',
    primaryAxisAlign: 'SPACE_BETWEEN',
    counterAxisAlign: 'CENTER',
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 16,
    paddingRight: 16,
    itemSpacing: 16
  })
  const cols = ['Name', 'Status', 'Amount', 'Date']
  for (const col of cols) {
    const colId = store.createShape('TEXT', 0, 0, 80, 16, tableId)
    graph.updateNode(colId, {
      name: col,
      text: col,
      fontSize: 12,
      fontWeight: 600,
      fills: [solid(GRAY_500)]
    })
  }

  // ─── Standalone shapes (bottom) ───────────────────────────────
  // Gradient showcase
  const grad1 = store.createShape('RECTANGLE', 60, 660, 180, 120)
  graph.updateNode(grad1, {
    name: 'Gradient Card',
    cornerRadius: 16,
    fills: [
      gradient([
        { color: { r: 0.99, g: 0.37, b: 0.33, a: 1 }, position: 0 },
        { color: { r: 0.93, g: 0.18, b: 0.65, a: 1 }, position: 0.5 },
        { color: { r: 0.55, g: 0.28, b: 0.96, a: 1 }, position: 1 }
      ])
    ]
  })
  const gradText = store.createShape('TEXT', 20, 80, 140, 20, grad1)
  graph.updateNode(gradText, {
    name: 'Label',
    text: 'Linear Gradient',
    fontSize: 14,
    fontWeight: 600,
    fills: [solid(WHITE)]
  })

  const grad2 = store.createShape('RECTANGLE', 260, 660, 180, 120)
  graph.updateNode(grad2, {
    name: 'Ocean',
    cornerRadius: 16,
    fills: [
      gradient([
        { color: { r: 0.04, g: 0.82, b: 0.67, a: 1 }, position: 0 },
        { color: { r: 0.13, g: 0.45, b: 0.96, a: 1 }, position: 1 }
      ])
    ]
  })
  const grad2Text = store.createShape('TEXT', 20, 80, 140, 20, grad2)
  graph.updateNode(grad2Text, {
    name: 'Label',
    text: 'Ocean Breeze',
    fontSize: 14,
    fontWeight: 600,
    fills: [solid(WHITE)]
  })

  const grad3 = store.createShape('RECTANGLE', 460, 660, 180, 120)
  graph.updateNode(grad3, {
    name: 'Sunset',
    cornerRadius: 16,
    fills: [
      gradient([
        { color: { r: 1, g: 0.6, b: 0.2, a: 1 }, position: 0 },
        { color: { r: 0.96, g: 0.26, b: 0.21, a: 1 }, position: 1 }
      ])
    ]
  })
  const grad3Text = store.createShape('TEXT', 20, 80, 140, 20, grad3)
  graph.updateNode(grad3Text, {
    name: 'Label',
    text: 'Warm Sunset',
    fontSize: 14,
    fontWeight: 600,
    fills: [solid(WHITE)]
  })

  // Typography showcase
  const typoFrame = store.createShape('FRAME', 700, 660, 300, 120)
  graph.updateNode(typoFrame, {
    name: 'Typography',
    cornerRadius: 12,
    fills: [solid(WHITE)],
    strokes: thinStroke(GRAY_200),
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    itemSpacing: 6,
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 20,
    paddingRight: 20
  })
  const typoItems = [
    { text: 'Heading', size: 24, weight: 700 },
    { text: 'Subheading', size: 16, weight: 600 },
    { text: 'Body text — The quick brown fox jumps.', size: 13, weight: 400 },
    { text: 'CAPTION · OVERLINE', size: 10, weight: 500 }
  ]
  for (const t of typoItems) {
    const tid = store.createShape('TEXT', 0, 0, 260, t.size + 4, typoFrame)
    graph.updateNode(tid, {
      name: t.text.split(' ')[0],
      text: t.text,
      fontSize: t.size,
      fontWeight: t.weight,
      fills: [solid(BLACK)]
    })
  }

  // Mixed shapes row
  const shapes = [
    {
      type: 'ELLIPSE' as const,
      x: 1060,
      fill: gradient([
        { color: PURPLE, position: 0 },
        { color: BLUE, position: 1 }
      ])
    },
    {
      type: 'RECTANGLE' as const,
      x: 1160,
      fill: gradient([
        { color: GREEN, position: 0 },
        { color: TEAL, position: 1 }
      ])
    },
    {
      type: 'ELLIPSE' as const,
      x: 1260,
      fill: gradient([
        { color: ORANGE, position: 0 },
        { color: RED, position: 1 }
      ])
    }
  ]
  for (const s of shapes) {
    const id = store.createShape(s.type, s.x, 680, 80, 80)
    graph.updateNode(id, {
      name: s.type === 'ELLIPSE' ? 'Circle' : 'Square',
      cornerRadius: s.type === 'RECTANGLE' ? 16 : 0,
      fills: [s.fill]
    })
  }

  // ─── Variable Collections ──────────────────────────────────────
  graph.addCollection({
    id: 'col-primitives',
    name: 'Primitives',
    modes: [
      { modeId: 'light', name: 'Light' },
      { modeId: 'dark', name: 'Dark' }
    ],
    defaultModeId: 'light',
    variableIds: []
  })

  const primitiveColors: Array<{
    id: string
    name: string
    light: Color
    dark: Color
  }> = [
    { id: 'var-white', name: 'White', light: WHITE, dark: { r: 0.12, g: 0.12, b: 0.13, a: 1 } },
    { id: 'var-black', name: 'Black', light: BLACK, dark: WHITE },
    {
      id: 'var-gray-50',
      name: 'Gray/50',
      light: GRAY_50,
      dark: { r: 0.1, g: 0.1, b: 0.11, a: 1 }
    },
    {
      id: 'var-gray-100',
      name: 'Gray/100',
      light: GRAY_100,
      dark: { r: 0.14, g: 0.14, b: 0.16, a: 1 }
    },
    {
      id: 'var-gray-200',
      name: 'Gray/200',
      light: GRAY_200,
      dark: { r: 0.22, g: 0.22, b: 0.24, a: 1 }
    },
    {
      id: 'var-gray-500',
      name: 'Gray/500',
      light: GRAY_500,
      dark: { r: 0.65, g: 0.65, b: 0.68, a: 1 }
    },
    { id: 'var-blue', name: 'Blue', light: BLUE, dark: { r: 0.33, g: 0.61, b: 1, a: 1 } },
    {
      id: 'var-green',
      name: 'Green',
      light: GREEN,
      dark: { r: 0.23, g: 0.87, b: 0.52, a: 1 }
    },
    { id: 'var-red', name: 'Red', light: RED, dark: { r: 1, g: 0.32, b: 0.32, a: 1 } }
  ]

  for (const c of primitiveColors) {
    graph.addVariable({
      id: c.id,
      name: c.name,
      type: 'COLOR',
      collectionId: 'col-primitives',
      valuesByMode: { light: c.light, dark: c.dark },
      description: '',
      hiddenFromPublishing: false
    })
  }

  graph.addCollection({
    id: 'col-semantic',
    name: 'Semantic',
    modes: [{ modeId: 'default', name: 'Default' }],
    defaultModeId: 'default',
    variableIds: []
  })

  const semanticVars: Array<{ id: string; name: string; aliasId: string }> = [
    { id: 'var-bg', name: 'Background', aliasId: 'var-white' },
    { id: 'var-bg-secondary', name: 'Background/Secondary', aliasId: 'var-gray-50' },
    { id: 'var-text-primary', name: 'Text/Primary', aliasId: 'var-black' },
    { id: 'var-text-secondary', name: 'Text/Secondary', aliasId: 'var-gray-500' },
    { id: 'var-border', name: 'Border', aliasId: 'var-gray-200' },
    { id: 'var-accent', name: 'Accent', aliasId: 'var-blue' },
    { id: 'var-success', name: 'Success', aliasId: 'var-green' },
    { id: 'var-error', name: 'Error', aliasId: 'var-red' }
  ]

  for (const s of semanticVars) {
    graph.addVariable({
      id: s.id,
      name: s.name,
      type: 'COLOR',
      collectionId: 'col-semantic',
      valuesByMode: { default: { aliasId: s.aliasId } },
      description: '',
      hiddenFromPublishing: false
    })
  }

  graph.addCollection({
    id: 'col-spacing',
    name: 'Spacing',
    modes: [
      { modeId: 'default', name: 'Default' },
      { modeId: 'compact', name: 'Compact' }
    ],
    defaultModeId: 'default',
    variableIds: []
  })

  const spacingVars: Array<{ id: string; name: string; default: number; compact: number }> = [
    { id: 'var-space-xs', name: 'Space/XS', default: 4, compact: 2 },
    { id: 'var-space-sm', name: 'Space/SM', default: 8, compact: 4 },
    { id: 'var-space-md', name: 'Space/MD', default: 16, compact: 12 },
    { id: 'var-space-lg', name: 'Space/LG', default: 24, compact: 16 },
    { id: 'var-space-xl', name: 'Space/XL', default: 32, compact: 24 },
    { id: 'var-radius-sm', name: 'Radius/SM', default: 4, compact: 2 },
    { id: 'var-radius-md', name: 'Radius/MD', default: 8, compact: 6 },
    { id: 'var-radius-lg', name: 'Radius/LG', default: 16, compact: 12 }
  ]

  for (const s of spacingVars) {
    graph.addVariable({
      id: s.id,
      name: s.name,
      type: 'FLOAT',
      collectionId: 'col-spacing',
      valuesByMode: { default: s.default, compact: s.compact },
      description: '',
      hiddenFromPublishing: false
    })
  }

  // ─── Section: Effects Showcase ──────────────────────────────────
  const effectsSectionId = store.createShape('SECTION', 60, 840, 920, 480)
  graph.updateNode(effectsSectionId, {
    name: 'Effects',
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
  })

  function dropShadow(
    ox = 0,
    oy = 4,
    radius = 8,
    spread = 0,
    color: Color = { r: 0, g: 0, b: 0, a: 0.25 }
  ): Effect {
    return {
      type: 'DROP_SHADOW',
      color,
      offset: { x: ox, y: oy },
      radius,
      spread,
      visible: true
    }
  }

  function innerShadow(
    ox = 0,
    oy = 2,
    radius = 4,
    spread = 0,
    color: Color = { r: 0, g: 0, b: 0, a: 0.2 }
  ): Effect {
    return {
      type: 'INNER_SHADOW',
      color,
      offset: { x: ox, y: oy },
      radius,
      spread,
      visible: true
    }
  }

  function blurEffect(type: Effect['type'], radius: number): Effect {
    return {
      type,
      color: { r: 0, g: 0, b: 0, a: 0 },
      offset: { x: 0, y: 0 },
      radius,
      spread: 0,
      visible: true
    }
  }

  // Row 1: Drop shadows
  const shadowLabel = store.createShape('TEXT', 32, 48, 200, 20, effectsSectionId)
  graph.updateNode(shadowLabel, {
    name: 'Label',
    text: 'Drop Shadow',
    fontSize: 13,
    fontWeight: 600,
    fills: [solid(GRAY_500)]
  })

  const shadowCard1 = store.createShape('FRAME', 32, 76, 160, 100, effectsSectionId)
  graph.updateNode(shadowCard1, {
    name: 'Subtle Shadow',
    cornerRadius: 12,
    fills: [solid(WHITE)],
    effects: [dropShadow(0, 2, 8, 0, { r: 0, g: 0, b: 0, a: 0.08 })]
  })
  const s1Text = store.createShape('TEXT', 16, 40, 128, 20, shadowCard1)
  graph.updateNode(s1Text, {
    name: 'Label',
    text: 'Subtle',
    fontSize: 13,
    fontWeight: 500,
    fills: [solid(GRAY_500)]
  })

  const shadowCard2 = store.createShape('FRAME', 220, 76, 160, 100, effectsSectionId)
  graph.updateNode(shadowCard2, {
    name: 'Medium Shadow',
    cornerRadius: 12,
    fills: [solid(WHITE)],
    effects: [dropShadow(0, 4, 16, 0, { r: 0, g: 0, b: 0, a: 0.15 })]
  })
  const s2Text = store.createShape('TEXT', 16, 40, 128, 20, shadowCard2)
  graph.updateNode(s2Text, {
    name: 'Label',
    text: 'Medium',
    fontSize: 13,
    fontWeight: 500,
    fills: [solid(GRAY_500)]
  })

  const shadowCard3 = store.createShape('FRAME', 408, 76, 160, 100, effectsSectionId)
  graph.updateNode(shadowCard3, {
    name: 'Heavy Shadow',
    cornerRadius: 12,
    fills: [solid(WHITE)],
    effects: [dropShadow(0, 8, 24, 0, { r: 0, g: 0, b: 0, a: 0.2 })]
  })
  const s3Text = store.createShape('TEXT', 16, 40, 128, 20, shadowCard3)
  graph.updateNode(s3Text, {
    name: 'Label',
    text: 'Heavy',
    fontSize: 13,
    fontWeight: 500,
    fills: [solid(GRAY_500)]
  })

  const shadowCard4 = store.createShape('FRAME', 596, 76, 160, 100, effectsSectionId)
  graph.updateNode(shadowCard4, {
    name: 'Spread Shadow',
    cornerRadius: 12,
    fills: [solid(WHITE)],
    effects: [dropShadow(0, 4, 12, 8, { r: 0.23, g: 0.51, b: 0.96, a: 0.3 })]
  })
  const s4Text = store.createShape('TEXT', 16, 40, 128, 20, shadowCard4)
  graph.updateNode(s4Text, {
    name: 'Label',
    text: 'With Spread',
    fontSize: 13,
    fontWeight: 500,
    fills: [solid(BLUE)]
  })

  // Row 2: Inner shadows
  const innerLabel = store.createShape('TEXT', 32, 208, 200, 20, effectsSectionId)
  graph.updateNode(innerLabel, {
    name: 'Label',
    text: 'Inner Shadow',
    fontSize: 13,
    fontWeight: 600,
    fills: [solid(GRAY_500)]
  })

  const innerCard1 = store.createShape('FRAME', 32, 236, 160, 100, effectsSectionId)
  graph.updateNode(innerCard1, {
    name: 'Inset Light',
    cornerRadius: 12,
    fills: [solid(GRAY_100)],
    effects: [innerShadow(0, 2, 6, 0, { r: 0, g: 0, b: 0, a: 0.12 })]
  })
  const i1Text = store.createShape('TEXT', 16, 40, 128, 20, innerCard1)
  graph.updateNode(i1Text, {
    name: 'Label',
    text: 'Inset',
    fontSize: 13,
    fontWeight: 500,
    fills: [solid(GRAY_500)]
  })

  const innerCard2 = store.createShape('FRAME', 220, 236, 160, 100, effectsSectionId)
  graph.updateNode(innerCard2, {
    name: 'Inset with Spread',
    cornerRadius: 12,
    fills: [solid(GRAY_100)],
    effects: [innerShadow(0, 2, 8, 4, { r: 0, g: 0, b: 0, a: 0.15 })]
  })
  const i2Text = store.createShape('TEXT', 16, 40, 128, 20, innerCard2)
  graph.updateNode(i2Text, {
    name: 'Label',
    text: 'Inset + Spread',
    fontSize: 13,
    fontWeight: 500,
    fills: [solid(GRAY_500)]
  })

  // Ellipse with inner shadow
  const innerEllipse = store.createShape('ELLIPSE', 408, 236, 100, 100, effectsSectionId)
  graph.updateNode(innerEllipse, {
    name: 'Inset Circle',
    fills: [
      gradient([
        { color: { r: 0.93, g: 0.94, b: 1, a: 1 }, position: 0 },
        { color: { r: 0.85, g: 0.86, b: 0.95, a: 1 }, position: 1 }
      ])
    ],
    effects: [innerShadow(0, 4, 12, 0, { r: 0.38, g: 0.35, b: 0.95, a: 0.3 })]
  })

  // Combined drop + inner shadow
  const comboCard = store.createShape('FRAME', 536, 236, 160, 100, effectsSectionId)
  graph.updateNode(comboCard, {
    name: 'Combined',
    cornerRadius: 12,
    fills: [solid(WHITE)],
    effects: [
      dropShadow(0, 4, 16, 0, { r: 0, g: 0, b: 0, a: 0.12 }),
      innerShadow(0, 1, 2, 0, { r: 0, g: 0, b: 0, a: 0.06 })
    ]
  })
  const comboText = store.createShape('TEXT', 16, 40, 128, 20, comboCard)
  graph.updateNode(comboText, {
    name: 'Label',
    text: 'Drop + Inner',
    fontSize: 13,
    fontWeight: 500,
    fills: [solid(GRAY_500)]
  })

  // Row 3: Text shadows & blurs
  const textFxLabel = store.createShape('TEXT', 32, 368, 200, 20, effectsSectionId)
  graph.updateNode(textFxLabel, {
    name: 'Label',
    text: 'Text Shadow & Blur',
    fontSize: 13,
    fontWeight: 600,
    fills: [solid(GRAY_500)]
  })

  // Text with drop shadow (renders on glyphs, not bounding box)
  const textShadow = store.createShape('TEXT', 32, 400, 200, 36, effectsSectionId)
  graph.updateNode(textShadow, {
    name: 'Text Shadow',
    text: 'Glyph Shadow',
    fontSize: 28,
    fontWeight: 700,
    fills: [solid(BLACK)],
    effects: [dropShadow(2, 2, 4, 0, { r: 0.23, g: 0.51, b: 0.96, a: 0.5 })]
  })

  // Text with inner shadow
  const textInner = store.createShape('TEXT', 260, 400, 200, 36, effectsSectionId)
  graph.updateNode(textInner, {
    name: 'Text Inner',
    text: 'Inner Glow',
    fontSize: 28,
    fontWeight: 700,
    fills: [solid(INDIGO)],
    effects: [innerShadow(0, -1, 3, 0, { r: 1, g: 1, b: 1, a: 0.6 })]
  })

  // Layer blur
  const blurRect = store.createShape('RECTANGLE', 500, 392, 120, 50, effectsSectionId)
  graph.updateNode(blurRect, {
    name: 'Layer Blur',
    cornerRadius: 10,
    fills: [
      gradient([
        { color: PURPLE, position: 0 },
        { color: BLUE, position: 1 }
      ])
    ],
    effects: [blurEffect('LAYER_BLUR', 4)]
  })

  // Background blur (glassmorphism card)
  const glassBg = store.createShape('FRAME', 652, 368, 200, 80, effectsSectionId)
  graph.updateNode(glassBg, {
    name: 'Glass Card',
    cornerRadius: 16,
    fills: [solid({ r: 1, g: 1, b: 1, a: 0.3 })],
    strokes: thinStroke({ r: 1, g: 1, b: 1, a: 0.4 }),
    effects: [blurEffect('BACKGROUND_BLUR', 16)]
  })
  const glassText = store.createShape('TEXT', 20, 30, 160, 20, glassBg)
  graph.updateNode(glassText, {
    name: 'Label',
    text: 'Glassmorphism',
    fontSize: 14,
    fontWeight: 600,
    fills: [solid(BLACK)]
  })

  // Bind variables to some demo nodes
  graph.bindVariable(sidebarId, 'fills/0/color', 'var-bg')
  graph.bindVariable(headerId, 'fills/0/color', 'var-bg')
  graph.bindVariable(frameId, 'fills/0/color', 'var-bg-secondary')
  graph.bindVariable(headerTitle, 'fills/0/color', 'var-text-primary')
  graph.bindVariable(chartTitle, 'fills/0/color', 'var-text-primary')

  computeAllLayouts(store.graph)
  store.clearSelection()
}
