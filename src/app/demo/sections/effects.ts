import { DEMO_COLORS, gradient, solid, thinStroke } from '@/app/demo/colors'
import { blurEffect, dropShadow, innerShadow } from '@/app/demo/effects'
import type { EditorStore } from '@/app/editor/session'

export function createEffectsSection(store: EditorStore) {
  const { graph } = store

  const effectsSectionId = store.createShape('SECTION', 60, 840, 920, 780)
  graph.updateNode(effectsSectionId, {
    name: 'Effects',
    fills: [solid(DEMO_COLORS.white)]
  })

  const shadowLabel = store.createShape('TEXT', 32, 48, 200, 20, effectsSectionId)
  graph.updateNode(shadowLabel, {
    name: 'Label',
    text: 'Drop Shadow',
    fontSize: 13,
    fontWeight: 600,
    fills: [solid(DEMO_COLORS.gray500)]
  })

  const shadowCard1 = store.createShape('FRAME', 32, 76, 160, 100, effectsSectionId)
  graph.updateNode(shadowCard1, {
    name: 'Subtle Shadow',
    cornerRadius: 12,
    fills: [solid(DEMO_COLORS.white)],
    effects: [dropShadow(0, 2, 8, 0, { r: 0, g: 0, b: 0, a: 0.08 })]
  })
  const s1Text = store.createShape('TEXT', 16, 40, 128, 20, shadowCard1)
  graph.updateNode(s1Text, {
    name: 'Label',
    text: 'Subtle',
    fontSize: 13,
    fontWeight: 500,
    fills: [solid(DEMO_COLORS.gray500)]
  })

  const shadowCard2 = store.createShape('FRAME', 220, 76, 160, 100, effectsSectionId)
  graph.updateNode(shadowCard2, {
    name: 'Medium Shadow',
    cornerRadius: 12,
    fills: [solid(DEMO_COLORS.white)],
    effects: [dropShadow(0, 4, 16, 0, { r: 0, g: 0, b: 0, a: 0.15 })]
  })
  const s2Text = store.createShape('TEXT', 16, 40, 128, 20, shadowCard2)
  graph.updateNode(s2Text, {
    name: 'Label',
    text: 'Medium',
    fontSize: 13,
    fontWeight: 500,
    fills: [solid(DEMO_COLORS.gray500)]
  })

  const shadowCard3 = store.createShape('FRAME', 408, 76, 160, 100, effectsSectionId)
  graph.updateNode(shadowCard3, {
    name: 'Heavy Shadow',
    cornerRadius: 12,
    fills: [solid(DEMO_COLORS.white)],
    effects: [dropShadow(0, 8, 24, 0, { r: 0, g: 0, b: 0, a: 0.2 })]
  })
  const s3Text = store.createShape('TEXT', 16, 40, 128, 20, shadowCard3)
  graph.updateNode(s3Text, {
    name: 'Label',
    text: 'Heavy',
    fontSize: 13,
    fontWeight: 500,
    fills: [solid(DEMO_COLORS.gray500)]
  })

  const shadowCard4 = store.createShape('FRAME', 596, 76, 160, 100, effectsSectionId)
  graph.updateNode(shadowCard4, {
    name: 'Spread Shadow',
    cornerRadius: 12,
    fills: [solid(DEMO_COLORS.white)],
    effects: [dropShadow(0, 4, 12, 8, { r: 0.23, g: 0.51, b: 0.96, a: 0.3 })]
  })
  const s4Text = store.createShape('TEXT', 16, 40, 128, 20, shadowCard4)
  graph.updateNode(s4Text, {
    name: 'Label',
    text: 'With Spread',
    fontSize: 13,
    fontWeight: 500,
    fills: [solid(DEMO_COLORS.blue)]
  })

  const innerLabel = store.createShape('TEXT', 32, 208, 200, 20, effectsSectionId)
  graph.updateNode(innerLabel, {
    name: 'Label',
    text: 'Inner Shadow',
    fontSize: 13,
    fontWeight: 600,
    fills: [solid(DEMO_COLORS.gray500)]
  })

  const innerCard1 = store.createShape('FRAME', 32, 236, 160, 100, effectsSectionId)
  graph.updateNode(innerCard1, {
    name: 'Inset Light',
    cornerRadius: 12,
    fills: [solid(DEMO_COLORS.gray100)],
    effects: [innerShadow(0, 2, 6, 0, { r: 0, g: 0, b: 0, a: 0.12 })]
  })
  const i1Text = store.createShape('TEXT', 16, 40, 128, 20, innerCard1)
  graph.updateNode(i1Text, {
    name: 'Label',
    text: 'Inset',
    fontSize: 13,
    fontWeight: 500,
    fills: [solid(DEMO_COLORS.gray500)]
  })

  const innerCard2 = store.createShape('FRAME', 220, 236, 160, 100, effectsSectionId)
  graph.updateNode(innerCard2, {
    name: 'Inset with Spread',
    cornerRadius: 12,
    fills: [solid(DEMO_COLORS.gray100)],
    effects: [innerShadow(0, 2, 8, 4, { r: 0, g: 0, b: 0, a: 0.15 })]
  })
  const i2Text = store.createShape('TEXT', 16, 40, 128, 20, innerCard2)
  graph.updateNode(i2Text, {
    name: 'Label',
    text: 'Inset + Spread',
    fontSize: 13,
    fontWeight: 500,
    fills: [solid(DEMO_COLORS.gray500)]
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
    fills: [solid(DEMO_COLORS.white)],
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
    fills: [solid(DEMO_COLORS.gray500)]
  })

  const textFxLabel = store.createShape('TEXT', 32, 368, 200, 20, effectsSectionId)
  graph.updateNode(textFxLabel, {
    name: 'Label',
    text: 'Text Shadow & Blur',
    fontSize: 13,
    fontWeight: 600,
    fills: [solid(DEMO_COLORS.gray500)]
  })

  const textShadow = store.createShape('TEXT', 32, 400, 200, 36, effectsSectionId)
  graph.updateNode(textShadow, {
    name: 'Text Shadow',
    text: 'Glyph Shadow',
    fontSize: 28,
    fontWeight: 700,
    fills: [solid(DEMO_COLORS.black)],
    effects: [dropShadow(2, 2, 4, 0, { r: 0.23, g: 0.51, b: 0.96, a: 0.5 })]
  })

  const textInner = store.createShape('TEXT', 260, 400, 200, 36, effectsSectionId)
  graph.updateNode(textInner, {
    name: 'Text Inner',
    text: 'Inner Glow',
    fontSize: 28,
    fontWeight: 700,
    fills: [solid(DEMO_COLORS.indigo)],
    effects: [innerShadow(0, -1, 3, 0, { r: 1, g: 1, b: 1, a: 0.6 })]
  })

  const blurRect = store.createShape('RECTANGLE', 500, 392, 120, 50, effectsSectionId)
  graph.updateNode(blurRect, {
    name: 'Layer Blur',
    cornerRadius: 10,
    fills: [
      gradient([
        { color: DEMO_COLORS.purple, position: 0 },
        { color: DEMO_COLORS.blue, position: 1 }
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
    fills: [solid(DEMO_COLORS.black)]
  })

  const blendMaskLabel = store.createShape('TEXT', 32, 488, 240, 20, effectsSectionId)
  graph.updateNode(blendMaskLabel, {
    name: 'Label',
    text: 'Blend modes & masks',
    fontSize: 13,
    fontWeight: 600,
    fills: [solid(DEMO_COLORS.gray500)]
  })

  const blendCard = store.createShape('FRAME', 32, 520, 256, 92, effectsSectionId)
  graph.updateNode(blendCard, {
    name: 'Blend Mode Stack',
    cornerRadius: 16,
    fills: [solid(DEMO_COLORS.gray50)],
    strokes: thinStroke(DEMO_COLORS.gray200)
  })
  const blendBase = store.createShape('ELLIPSE', 24, 18, 72, 72, blendCard)
  graph.updateNode(blendBase, {
    name: 'Multiply Blue',
    fills: [solid({ r: 0.16, g: 0.46, b: 1, a: 0.8 })],
    blendMode: 'MULTIPLY'
  })
  const blendMiddle = store.createShape('ELLIPSE', 70, 18, 72, 72, blendCard)
  graph.updateNode(blendMiddle, {
    name: 'Multiply Red',
    fills: [solid({ r: 1, g: 0.22, b: 0.34, a: 0.8 })],
    blendMode: 'MULTIPLY'
  })
  const blendTop = store.createShape('ELLIPSE', 116, 18, 72, 72, blendCard)
  graph.updateNode(blendTop, {
    name: 'Screen Gold',
    fills: [solid({ r: 1, g: 0.72, b: 0.16, a: 0.72 })],
    blendMode: 'SCREEN'
  })
  const blendText = store.createShape('TEXT', 168, 32, 72, 32, blendCard)
  graph.updateNode(blendText, {
    name: 'Label',
    text: 'Multiply\n+ Screen',
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 16,
    fills: [solid(DEMO_COLORS.gray500)]
  })

  const fillBlendCard = store.createShape('FRAME', 312, 520, 204, 92, effectsSectionId)
  graph.updateNode(fillBlendCard, {
    name: 'Fill Blend Card',
    cornerRadius: 16,
    fills: [
      gradient([
        { color: DEMO_COLORS.purple, position: 0 },
        { color: DEMO_COLORS.blue, position: 1 }
      ]),
      { ...solid(DEMO_COLORS.orange, 0.7), blendMode: 'OVERLAY' }
    ],
    effects: [dropShadow(0, 6, 18, 0, { r: 0.23, g: 0.51, b: 0.96, a: 0.2 })]
  })
  const fillBlendText = store.createShape('TEXT', 20, 32, 164, 24, fillBlendCard)
  graph.updateNode(fillBlendText, {
    name: 'Label',
    text: 'Overlay fill',
    fontSize: 16,
    fontWeight: 700,
    fills: [solid(DEMO_COLORS.white)]
  })

  const maskCard = store.createShape('FRAME', 540, 520, 300, 92, effectsSectionId)
  graph.updateNode(maskCard, {
    name: 'Mask Stack Card',
    cornerRadius: 16,
    fills: [solid(DEMO_COLORS.gray50)],
    strokes: thinStroke(DEMO_COLORS.gray200),
    clipsContent: true
  })
  const maskBg = store.createShape('RECTANGLE', 0, 0, 300, 92, maskCard)
  graph.updateNode(maskBg, {
    name: 'Backdrop',
    fills: [solid({ r: 0.08, g: 0.1, b: 0.18, a: 1 })]
  })
  const maskText = store.createShape('TEXT', 104, 26, 172, 36, maskCard)
  graph.updateNode(maskText, {
    name: 'Label',
    text: 'Sibling mask stack\nfrom imported files',
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 17,
    fills: [solid(DEMO_COLORS.white)]
  })
  const maskShape = store.createShape('ELLIPSE', 22, 16, 60, 60, maskCard)
  graph.updateNode(maskShape, {
    name: 'Avatar Mask',
    fills: [solid(DEMO_COLORS.white)],
    isMask: true,
    maskType: 'ALPHA'
  })
  const stripeA = store.createShape('RECTANGLE', 14, 12, 84, 28, maskCard)
  graph.updateNode(stripeA, {
    name: 'Masked Stripe A',
    rotation: -20,
    fills: [solid(DEMO_COLORS.blue)]
  })
  const stripeB = store.createShape('RECTANGLE', 14, 36, 84, 28, maskCard)
  graph.updateNode(stripeB, {
    name: 'Masked Stripe B',
    rotation: -20,
    fills: [solid(DEMO_COLORS.purple)]
  })
  const stripeC = store.createShape('RECTANGLE', 14, 60, 84, 28, maskCard)
  graph.updateNode(stripeC, {
    name: 'Masked Stripe C',
    rotation: -20,
    fills: [solid(DEMO_COLORS.teal)]
  })

  const smoothingLabel = store.createShape('TEXT', 32, 644, 280, 20, effectsSectionId)
  graph.updateNode(smoothingLabel, {
    name: 'Label',
    text: 'Corner smoothing & effect blends',
    fontSize: 13,
    fontWeight: 600,
    fills: [solid(DEMO_COLORS.gray500)]
  })

  const smoothingCard = store.createShape('FRAME', 32, 676, 256, 104, effectsSectionId)
  graph.updateNode(smoothingCard, {
    name: 'Smooth Corner Comparison',
    cornerRadius: 16,
    fills: [solid(DEMO_COLORS.gray50)],
    strokes: thinStroke(DEMO_COLORS.gray200)
  })
  const regularCorner = store.createShape('RECTANGLE', 24, 18, 58, 58, smoothingCard)
  graph.updateNode(regularCorner, {
    name: 'Regular Radius',
    cornerRadius: 18,
    fills: [solid(DEMO_COLORS.blue)]
  })
  const smoothCorner = store.createShape('RECTANGLE', 102, 18, 58, 58, smoothingCard)
  graph.updateNode(smoothCorner, {
    name: 'Smoothed Radius',
    cornerRadius: 18,
    cornerSmoothing: 0.9,
    fills: [solid(DEMO_COLORS.purple)]
  })
  const cornerLabel = store.createShape('TEXT', 176, 26, 56, 36, smoothingCard)
  graph.updateNode(cornerLabel, {
    name: 'Label',
    text: 'Radius\n+ smooth',
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 16,
    fills: [solid(DEMO_COLORS.gray500)]
  })

  const independentCard = store.createShape('FRAME', 312, 676, 204, 104, effectsSectionId)
  graph.updateNode(independentCard, {
    name: 'Independent Smooth Corners',
    cornerRadius: 28,
    cornerSmoothing: 1,
    independentCorners: true,
    topLeftRadius: 36,
    topRightRadius: 10,
    bottomRightRadius: 36,
    bottomLeftRadius: 10,
    fills: [
      gradient([
        { color: DEMO_COLORS.teal, position: 0 },
        { color: DEMO_COLORS.blue, position: 1 }
      ])
    ],
    effects: [dropShadow(0, 8, 20, 0, { r: 0.08, g: 0.73, b: 0.73, a: 0.24 })]
  })
  const independentText = store.createShape('TEXT', 20, 34, 164, 24, independentCard)
  graph.updateNode(independentText, {
    name: 'Label',
    text: 'Independent corners',
    fontSize: 15,
    fontWeight: 700,
    fills: [solid(DEMO_COLORS.white)]
  })

  const effectBlendCard = store.createShape('FRAME', 540, 676, 300, 104, effectsSectionId)
  graph.updateNode(effectBlendCard, {
    name: 'Effect Blend Card',
    cornerRadius: 18,
    fills: [solid({ r: 0.08, g: 0.1, b: 0.18, a: 1 })],
    clipsContent: true
  })
  const glowBase = store.createShape('ELLIPSE', 22, 14, 76, 76, effectBlendCard)
  graph.updateNode(glowBase, {
    name: 'Glow Base',
    fills: [solid({ r: 0.24, g: 0.46, b: 1, a: 1 })]
  })
  const glowShape = store.createShape('RECTANGLE', 70, 22, 96, 60, effectBlendCard)
  graph.updateNode(glowShape, {
    name: 'Screen Shadow Blend',
    cornerRadius: 22,
    cornerSmoothing: 0.85,
    fills: [solid({ r: 0.58, g: 0.27, b: 0.95, a: 0.7 })],
    effects: [
      { ...dropShadow(0, 0, 28, 0, { r: 0.56, g: 0.33, b: 1, a: 0.72 }), blendMode: 'SCREEN' }
    ]
  })
  const effectBlendText = store.createShape('TEXT', 184, 34, 88, 34, effectBlendCard)
  graph.updateNode(effectBlendText, {
    name: 'Label',
    text: 'Screen\nshadow',
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 17,
    fills: [solid(DEMO_COLORS.white)]
  })
}
