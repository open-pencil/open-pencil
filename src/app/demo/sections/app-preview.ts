import {
  BLACK,
  BLUE,
  GRAY_200,
  GRAY_50,
  GRAY_500,
  GREEN,
  INDIGO,
  RED,
  WHITE,
  gradient,
  solid,
  thinStroke
} from '@/app/demo/colors'

import type { EditorStore } from '@/app/editor/session'

export function createAppPreviewSection(
  store: EditorStore,
  btnCompId: string,
  badgeCompId: string
) {
  const { graph } = store

  const appSectionId = store.createShape('SECTION', 1040, 60, 560, 540)
  graph.updateNode(appSectionId, { name: 'App Preview' })

  const frameId = store.createShape('FRAME', 20, 48, 520, 460, appSectionId)
  graph.updateNode(frameId, {
    name: 'Dashboard',
    fills: [solid(GRAY_50)],
    strokes: thinStroke(GRAY_200),
    clipsContent: true
  })

  const sidebarId = store.createShape('RECTANGLE', 0, 0, 56, 460, frameId)
  graph.updateNode(sidebarId, {
    name: 'Sidebar',
    fills: [solid(WHITE)],
    strokes: thinStroke(GRAY_200)
  })

  for (let i = 0; i < 5; i++) {
    const dotId = store.createShape('ELLIPSE', 18, 20 + i * 40, 20, 20, frameId)
    graph.updateNode(dotId, {
      name: `Nav ${i + 1}`,
      fills: [solid(i === 0 ? BLUE : GRAY_200)]
    })
  }

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

  const headerBtn = graph.createInstance(btnCompId, frameId, { x: 400, y: 8 })
  if (headerBtn) graph.updateNode(headerBtn.id, { x: 400, y: 8 })

  const headerBadge = graph.createInstance(badgeCompId, frameId, { x: 200, y: 18 })
  if (headerBadge) graph.updateNode(headerBadge.id, { x: 200, y: 18 })

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

  return { sidebarId, headerId, frameId, headerTitle, chartTitle }
}
