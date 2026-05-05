import {
  BLACK,
  BLUE,
  GRAY_100,
  GRAY_500,
  INDIGO,
  PURPLE,
  WHITE,
  gradient,
  solid,
  thinStroke
} from '@/app/demo/colors'
import { blurEffect, dropShadow, innerShadow } from '@/app/demo/effects'
import type { EditorStore } from '@/app/editor/session'

export function createEffectsSection(store: EditorStore) {
  const { graph } = store

  const effectsSectionId = store.createShape('SECTION', 60, 840, 920, 480)
  graph.updateNode(effectsSectionId, {
    name: 'Effects',
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
  })

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

  const textFxLabel = store.createShape('TEXT', 32, 368, 200, 20, effectsSectionId)
  graph.updateNode(textFxLabel, {
    name: 'Label',
    text: 'Text Shadow & Blur',
    fontSize: 13,
    fontWeight: 600,
    fills: [solid(GRAY_500)]
  })

  const textShadow = store.createShape('TEXT', 32, 400, 200, 36, effectsSectionId)
  graph.updateNode(textShadow, {
    name: 'Text Shadow',
    text: 'Glyph Shadow',
    fontSize: 28,
    fontWeight: 700,
    fills: [solid(BLACK)],
    effects: [dropShadow(2, 2, 4, 0, { r: 0.23, g: 0.51, b: 0.96, a: 0.5 })]
  })

  const textInner = store.createShape('TEXT', 260, 400, 200, 36, effectsSectionId)
  graph.updateNode(textInner, {
    name: 'Text Inner',
    text: 'Inner Glow',
    fontSize: 28,
    fontWeight: 700,
    fills: [solid(INDIGO)],
    effects: [innerShadow(0, -1, 3, 0, { r: 1, g: 1, b: 1, a: 0.6 })]
  })

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
}
