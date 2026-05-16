import {
  BLACK,
  BLUE,
  GRAY_100,
  GRAY_200,
  GRAY_500,
  GREEN,
  INDIGO,
  ORANGE,
  PURPLE,
  RED,
  TEAL,
  WHITE,
  gradient,
  solid,
  thinStroke
} from '@/app/demo/colors'
import { makeComponent } from '@/app/demo/helpers'
import type { EditorStore } from '@/app/editor/session'

export function createComponentsSection(store: EditorStore) {
  const { graph } = store

  const compSectionId = store.createShape('SECTION', 60, 60, 920, 540)
  graph.updateNode(compSectionId, { name: 'Components' })

  const btnId = store.createShape('FRAME', 32, 76, 120, 40, compSectionId)
  graph.updateNode(btnId, {
    name: 'Button/Primary',
    fills: [],
    strokes: [],
    clipsContent: false
  })
  const btnSurfaceId = store.createShape('FRAME', 0, 0, 120, 40, btnId)
  graph.updateNode(btnSurfaceId, {
    name: 'Surface',
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
  const btnTextId = store.createShape('TEXT', 0, 0, 80, 20, btnSurfaceId)
  graph.updateNode(btnTextId, {
    name: 'Label',
    text: 'Get Started',
    fontSize: 14,
    fontWeight: 600,
    textAutoResize: 'WIDTH_AND_HEIGHT',
    fills: [solid(WHITE)]
  })
  const btnCompId = makeComponent(store, [btnId])

  const btn2Id = store.createShape('FRAME', 216, 76, 100, 40, compSectionId)
  graph.updateNode(btn2Id, {
    name: 'Button/Secondary',
    fills: [],
    strokes: [],
    clipsContent: false
  })
  const btn2SurfaceId = store.createShape('FRAME', 0, 0, 100, 40, btn2Id)
  graph.updateNode(btn2SurfaceId, {
    name: 'Surface',
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
  const btn2TextId = store.createShape('TEXT', 0, 0, 60, 20, btn2SurfaceId)
  graph.updateNode(btn2TextId, {
    name: 'Label',
    text: 'Cancel',
    fontSize: 14,
    fontWeight: 500,
    textAutoResize: 'WIDTH_AND_HEIGHT',
    fills: [solid(BLACK)]
  })
  const btn2CompId = makeComponent(store, [btn2Id])

  store.select([btnCompId, btn2CompId])
  store.createComponentSetFromComponents()
  const buttonSetId = [...store.state.selectedIds][0]
  graph.updateNode(buttonSetId, { x: 32, y: 44, width: 400, height: 136, fills: [] })
  graph.updateNode(btnCompId, { x: 40, y: 64 })
  graph.updateNode(btn2CompId, { x: 224, y: 64 })

  const chipId = store.createShape('FRAME', 500, 72, 80, 28, compSectionId)
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
    textAutoResize: 'WIDTH_AND_HEIGHT',
    fills: [solid(INDIGO)]
  })
  makeComponent(store, [chipId])

  const avatarId = store.createShape('ELLIPSE', 640, 68, 40, 40, compSectionId)
  graph.updateNode(avatarId, {
    name: 'Avatar',
    fills: [
      gradient([
        { color: PURPLE, position: 0 },
        { color: BLUE, position: 1 }
      ])
    ]
  })
  const avatarCompId = makeComponent(store, [avatarId])
  graph.updateNode(avatarCompId, { name: 'Avatar' })

  const cardId = store.createShape('FRAME', 32, 216, 280, 160, compSectionId)
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
    textAutoResize: 'HEIGHT',
    layoutAlignSelf: 'STRETCH',
    fills: [solid(BLACK)]
  })
  const cardDescId = store.createShape('TEXT', 0, 0, 240, 36, cardId)
  graph.updateNode(cardDescId, {
    name: 'Description',
    text: 'Track your key metrics and performance indicators in real time.',
    fontSize: 13,
    fontWeight: 400,
    textAutoResize: 'HEIGHT',
    layoutAlignSelf: 'STRETCH',
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

  const inputId = store.createShape('FRAME', 344, 216, 240, 40, compSectionId)
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
    textAutoResize: 'HEIGHT',
    layoutAlignSelf: 'STRETCH',
    fills: [solid(GRAY_500)]
  })
  makeComponent(store, [inputId])

  const badgeId = store.createShape('FRAME', 344, 284, 48, 24, compSectionId)
  graph.updateNode(badgeId, {
    name: 'Badge',
    cornerRadius: 12,
    fills: [solid({ r: 0.93, g: 1, b: 0.95, a: 1 })],
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    primaryAxisAlign: 'CENTER',
    counterAxisAlign: 'CENTER',
    itemSpacing: 4,
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
    textAutoResize: 'WIDTH_AND_HEIGHT',
    fills: [solid(GREEN)]
  })
  const badgeCompId = makeComponent(store, [badgeId])

  const swatches = [
    { name: 'Blue', color: BLUE, x: 32 },
    { name: 'Indigo', color: INDIGO, x: 88 },
    { name: 'Purple', color: PURPLE, x: 144 },
    { name: 'Green', color: GREEN, x: 200 },
    { name: 'Teal', color: TEAL, x: 256 },
    { name: 'Orange', color: ORANGE, x: 312 },
    { name: 'Red', color: RED, x: 368 }
  ]
  for (const swatch of swatches) {
    const id = store.createShape('ELLIPSE', swatch.x, 460, 44, 44, compSectionId)
    graph.updateNode(id, { name: swatch.name, fills: [solid(swatch.color)] })
  }

  return { btnCompId, badgeCompId }
}
