import { describe, expect, test } from 'bun:test'

import { createAPI, registerTestFont } from '#core-tests/helpers/figma-api'

// Figma's answers measured in Figma desktop 126.

const RED = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }] as const
const BLUE = [{ type: 'SOLID', color: { r: 0, g: 0, b: 1 } }] as const

function rectangle(figma: ReturnType<typeof createAPI>, props: Record<string, unknown> = {}) {
  const rect = figma.createRectangle()
  rect.resize(40, 20)
  Object.assign(rect, props)
  return rect
}

describe('getCSSAsync', () => {
  test('writes a box’s size, turn, corners, border, opacity, and fill in Figma’s order', async () => {
    const figma = createAPI()
    expect(await rectangle(figma, { fills: [...RED] }).getCSSAsync()).toEqual({
      width: '40px',
      height: '20px',
      background: '#F00'
    })
    const styled = rectangle(figma, {
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.6 }, opacity: 0.5 }],
      strokes: [...BLUE],
      strokeWeight: 2,
      cornerRadius: 8,
      opacity: 0.8,
      rotation: 30
    })
    expect(Object.entries(await styled.getCSSAsync())).toEqual([
      ['width', '40px'],
      ['height', '20px'],
      ['transform', 'rotate(-30deg)'],
      ['border-radius', '8px'],
      ['border', '2px solid #00F'],
      ['opacity', '0.8'],
      ['background', 'rgba(51, 102, 153, 0.50)']
    ])
    const corners = rectangle(figma, {
      topLeftRadius: 4,
      bottomRightRadius: 10,
      strokes: [...BLUE],
      strokeAlign: 'OUTSIDE',
      dashPattern: [4, 2],
      blendMode: 'MULTIPLY'
    })
    expect(await corners.getCSSAsync()).toEqual({
      width: '40px',
      height: '20px',
      'border-radius': '4px 0 10px 0',
      border: '1px dashed #00F',
      background: '#D9D9D9',
      'mix-blend-mode': 'multiply'
    })
  })

  test('writes gradients, stacked fills, images, and per-side borders', async () => {
    const figma = createAPI()
    const stops = [
      { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
      { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
    ]
    const identity = [
      [1, 0, 0],
      [0, 1, 0]
    ]
    const linear = rectangle(figma, {
      fills: [{ type: 'GRADIENT_LINEAR', gradientTransform: identity, gradientStops: stops }]
    })
    expect((await linear.getCSSAsync()).background).toBe(
      'linear-gradient(90deg, #F00 0%, #00F 100%)'
    )
    const radial = rectangle(figma, {
      fills: [
        {
          type: 'GRADIENT_RADIAL',
          gradientTransform: identity,
          gradientStops: [
            { position: 0, color: { r: 1, g: 1, b: 1, a: 1 } },
            { position: 1, color: { r: 0, g: 0, b: 0, a: 0.5 } }
          ]
        }
      ]
    })
    expect((await radial.getCSSAsync()).background).toBe(
      'radial-gradient(50% 50% at 50% 50%, #FFF 0%, rgba(0, 0, 0, 0.50) 100%)'
    )
    const stacked = rectangle(figma, {
      fills: [...RED, { type: 'SOLID', color: { r: 0, g: 0, b: 1 }, opacity: 0.5 }]
    })
    expect((await stacked.getCSSAsync()).background).toBe(
      'linear-gradient(0deg, rgba(0, 0, 255, 0.50) 0%, rgba(0, 0, 255, 0.50) 100%), #F00'
    )
    const sides = rectangle(figma, {
      strokes: [...BLUE],
      strokeTopWeight: 2,
      strokeRightWeight: 0,
      strokeBottomWeight: 1,
      strokeLeftWeight: 0
    })
    expect(await sides.getCSSAsync()).toEqual({
      width: '40px',
      height: '20px',
      'border-top': '2px solid #00F',
      'border-bottom': '1px solid #00F',
      background: '#D9D9D9'
    })
    expect(await rectangle(figma, { fills: [] }).getCSSAsync()).toEqual({
      width: '40px',
      height: '20px'
    })
  })

  test('writes shadows, and blurs at half their radius', async () => {
    const figma = createAPI()
    const shadowed = rectangle(figma, {
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.25 },
          offset: { x: 0, y: 4 },
          radius: 4,
          spread: 0,
          visible: true,
          blendMode: 'NORMAL'
        },
        { type: 'LAYER_BLUR', radius: 6, visible: true }
      ]
    })
    expect(await shadowed.getCSSAsync()).toMatchObject({
      'box-shadow': '0 4px 4px 0 rgba(0, 0, 0, 0.25)',
      filter: 'blur(3px)'
    })
    const inset = rectangle(figma, {
      effects: [
        {
          type: 'INNER_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 1, y: 2 },
          radius: 3,
          spread: 1,
          visible: true,
          blendMode: 'NORMAL'
        },
        { type: 'BACKGROUND_BLUR', radius: 10, visible: true }
      ]
    })
    expect(await inset.getCSSAsync()).toMatchObject({
      'box-shadow': '1px 2px 3px 1px rgba(0, 0, 0, 0.50) inset',
      'backdrop-filter': 'blur(5px)'
    })
  })

  test('writes auto layout and what its children take from it', async () => {
    const figma = createAPI()
    const row = figma.createFrame()
    row.layoutMode = 'HORIZONTAL'
    row.itemSpacing = 8
    row.paddingLeft = 16
    row.paddingRight = 16
    row.paddingTop = 4
    row.paddingBottom = 4
    row.primaryAxisAlignItems = 'CENTER'
    row.counterAxisAlignItems = 'CENTER'
    row.fills = [...RED]
    row.primaryAxisSizingMode = 'AUTO'
    row.counterAxisSizingMode = 'AUTO'
    const grow = figma.createRectangle()
    row.appendChild(grow)
    grow.resize(10, 10)
    grow.layoutGrow = 1
    const absolute = figma.createRectangle()
    row.appendChild(absolute)
    absolute.layoutPositioning = 'ABSOLUTE'
    absolute.x = 3
    absolute.y = 5
    absolute.resize(6, 6)
    expect(Object.entries(await row.getCSSAsync())).toEqual([
      ['display', 'inline-flex'],
      ['padding', '4px 16px'],
      ['justify-content', 'center'],
      ['align-items', 'center'],
      ['gap', '8px'],
      ['background', '#F00']
    ])
    expect(await grow.getCSSAsync()).toEqual({
      height: '10px',
      flex: '1 0 0',
      background: '#D9D9D9'
    })
    expect(Object.entries(await absolute.getCSSAsync())).toEqual([
      ['width', '6px'],
      ['height', '6px'],
      ['position', 'absolute'],
      ['left', '3px'],
      ['top', '5px'],
      ['background', '#D9D9D9']
    ])

    const column = figma.createFrame()
    column.layoutMode = 'VERTICAL'
    column.resize(200, 120)
    column.primaryAxisSizingMode = 'FIXED'
    column.counterAxisSizingMode = 'FIXED'
    column.itemSpacing = 12
    column.paddingTop = 8
    column.paddingBottom = 8
    column.paddingLeft = 8
    column.paddingRight = 8
    column.primaryAxisAlignItems = 'SPACE_BETWEEN'
    column.counterAxisAlignItems = 'MAX'
    column.minWidth = 100
    column.maxWidth = 300
    column.fills = []
    expect(Object.entries(await column.getCSSAsync())).toEqual([
      ['display', 'flex'],
      ['width', '200px'],
      ['height', '120px'],
      ['min-width', '100px'],
      ['max-width', '300px'],
      ['padding', '8px'],
      ['flex-direction', 'column'],
      ['justify-content', 'space-between'],
      ['align-items', 'flex-end']
    ])

    const wrap = figma.createFrame()
    wrap.layoutMode = 'HORIZONTAL'
    wrap.layoutWrap = 'WRAP'
    wrap.counterAxisSpacing = 6
    wrap.itemSpacing = 4
    wrap.resize(100, 50)
    wrap.primaryAxisSizingMode = 'FIXED'
    expect(await wrap.getCSSAsync()).toMatchObject({
      display: 'flex',
      'align-items': 'flex-start',
      gap: '6px 4px',
      'flex-wrap': 'wrap'
    })
  })

  test('writes text’s font, colour, spacing, and decoration', async () => {
    const figma = createAPI()
    await registerTestFont('Inter')
    await figma.loadFontAsync({ family: 'Inter', style: 'Bold' })
    const text = figma.createText()
    text.characters = 'Hello'
    text.fontSize = 18
    text.fontName = { family: 'Inter', style: 'Bold' }
    text.fills = [...BLUE]
    text.letterSpacing = { unit: 'PERCENT', value: 2 }
    text.lineHeight = { unit: 'PIXELS', value: 24 }
    text.textAlignHorizontal = 'CENTER'
    text.textDecoration = 'UNDERLINE'
    text.textCase = 'UPPER'
    expect(Object.entries(await text.getCSSAsync())).toEqual([
      ['color', '#00F'],
      ['text-align', 'center'],
      ['font-family', 'Inter'],
      ['font-size', '18px'],
      ['font-style', 'normal'],
      ['font-weight', '700'],
      ['line-height', '24px /* 133.333% */'],
      ['letter-spacing', '0.36px'],
      ['text-decoration-line', 'underline'],
      ['text-decoration-style', 'solid'],
      ['text-decoration-skip-ink', 'auto'],
      ['text-decoration-thickness', 'auto'],
      ['text-underline-offset', 'auto'],
      ['text-underline-position', 'from-font'],
      ['text-transform', 'uppercase']
    ])
  })

  test('writes shapes as SVG paints, a line as its stroke’s box, a group by its size', async () => {
    const figma = createAPI()
    const ellipse = figma.createEllipse()
    ellipse.resize(20, 20)
    ellipse.fills = [...RED]
    expect(await ellipse.getCSSAsync()).toEqual({ width: '20px', height: '20px', fill: '#F00' })
    const vector = figma.createVector()
    vector.vectorPaths = [{ windingRule: 'NONZERO', data: 'M 0 0 L 10 10 L 20 0 Z' }]
    vector.fills = [...RED]
    expect(await vector.getCSSAsync()).toEqual({
      width: '20px',
      height: '10px',
      fill: '#F00',
      'stroke-width': '1px',
      stroke: '#000'
    })
    const line = figma.createLine()
    line.resize(30, 0)
    line.strokes = [...BLUE]
    line.strokeWeight = 2
    expect(await line.getCSSAsync()).toEqual({ width: '30px', height: '2px', background: '#00F' })
    const group = figma.group([figma.createRectangle()], figma.currentPage)
    expect(await group.getCSSAsync()).toEqual({ width: '100px', height: '100px' })
    expect(await figma.currentPage.getCSSAsync()).toEqual({})
  })

  test('names bound variables as Dev Mode does, or by their web code syntax', async () => {
    const figma = createAPI()
    const collection = figma.variables.createVariableCollection('Tokens')
    const mode = collection.modes[0].modeId
    const color = (name: string, web?: string) => {
      const variable = figma.variables.createVariable(name, collection, 'COLOR')
      variable.setValueForMode(mode, { r: 0, g: 0.5, b: 1, a: 1 })
      if (web) variable.setVariableCodeSyntax('WEB', web)
      return variable
    }
    const rect = rectangle(figma)
    const background = async (name: string, web?: string) => {
      rect.fills = [
        figma.variables.setBoundVariableForPaint(
          { type: 'SOLID', color: { r: 0, g: 0, b: 0 } },
          'color',
          color(name, web)
        )
      ]
      return (await rect.getCSSAsync()).background
    }
    expect(await background('brand/primary')).toBe('var(--brand-primary, #0080FF)')
    expect(await background('Brand Color/Primary 500')).toBe(
      'var(--Brand-Color-Primary-500, #0080FF)'
    )
    expect(await background('brandPrimary')).toBe('var(--brandPrimary, #0080FF)')
    expect(await background('x/y', 'var(--my-token)')).toBe('var(--my-token)')

    const space = figma.variables.createVariable('Space/md', collection, 'FLOAT')
    space.setValueForMode(mode, 12)
    const frame = figma.createFrame()
    frame.layoutMode = 'HORIZONTAL'
    frame.primaryAxisSizingMode = 'FIXED'
    frame.setBoundVariable('itemSpacing', space)
    frame.setBoundVariable('paddingLeft', space)
    frame.cornerRadius = 4
    frame.setBoundVariable('topLeftRadius', space)
    expect(await frame.getCSSAsync()).toMatchObject({
      'padding-left': 'var(--Space-md, 12px)',
      gap: 'var(--Space-md, 12px)',
      'border-radius': 'var(--Space-md, 12px) 4px 4px 4px'
    })
  })
})
