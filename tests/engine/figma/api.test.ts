import { describe, expect, test } from 'bun:test'

import { FigmaAPI, SceneGraph, type Fill } from '@open-pencil/core'

function createAPI(): FigmaAPI {
  return new FigmaAPI(new SceneGraph())
}

describe('FigmaAPI', () => {
  describe('document & pages', () => {
    test('root has pages as children', () => {
      const api = createAPI()
      expect(api.root.children.length).toBeGreaterThan(0)
      expect(api.root.children[0].type).toBe('CANVAS')
    })

    test('currentPage is first page', () => {
      const api = createAPI()
      expect(api.currentPage.type).toBe('CANVAS')
      expect(api.currentPage.name).toBe('Page 1')
    })

    test('createPage adds a new page', () => {
      const api = createAPI()
      const page = api.createPage()
      expect(page.type).toBe('CANVAS')
      expect(api.root.children.length).toBe(2)
    })

    test('currentPage can be switched', () => {
      const api = createAPI()
      const page2 = api.createPage()
      page2.name = 'Page 2'
      api.currentPage = page2
      expect(api.currentPage.name).toBe('Page 2')
    })

    test('getNodeById returns proxy', () => {
      const api = createAPI()
      const frame = api.createFrame()
      const found = api.getNodeById(frame.id)
      expect(found).not.toBeNull()
      expect(found!.id).toBe(frame.id)
    })

    test('getNodeById returns null for unknown id', () => {
      const api = createAPI()
      expect(api.getNodeById('nonexistent')).toBeNull()
    })
  })

  describe('node creation', () => {
    test('createFrame', () => {
      const api = createAPI()
      const frame = api.createFrame()
      expect(frame.type).toBe('FRAME')
      expect(frame.parent!.id).toBe(api.currentPage.id)
    })

    test('createRectangle', () => {
      const api = createAPI()
      const rect = api.createRectangle()
      expect(rect.type).toBe('RECTANGLE')
    })

    test('createEllipse', () => {
      const api = createAPI()
      expect(api.createEllipse().type).toBe('ELLIPSE')
    })

    test('createText', () => {
      const api = createAPI()
      expect(api.createText().type).toBe('TEXT')
    })

    test('createLine', () => {
      const api = createAPI()
      expect(api.createLine().type).toBe('LINE')
    })

    test('createPolygon', () => {
      const api = createAPI()
      expect(api.createPolygon().type).toBe('POLYGON')
    })

    test('createStar', () => {
      const api = createAPI()
      expect(api.createStar().type).toBe('STAR')
    })

    test('createVector', () => {
      const api = createAPI()
      expect(api.createVector().type).toBe('VECTOR')
    })

    test('createComponent', () => {
      const api = createAPI()
      expect(api.createComponent().type).toBe('COMPONENT')
    })

    test('createSection', () => {
      const api = createAPI()
      expect(api.createSection().type).toBe('SECTION')
    })

    test('created node is child of current page', () => {
      const api = createAPI()
      const frame = api.createFrame()
      expect(api.currentPage.children.some((c) => c.id === frame.id)).toBe(true)
    })
  })

  describe('property access', () => {
    test('name get/set', () => {
      const api = createAPI()
      const frame = api.createFrame()
      frame.name = 'Card'
      expect(frame.name).toBe('Card')
    })

    test('position get/set', () => {
      const api = createAPI()
      const frame = api.createFrame()
      frame.x = 50
      frame.y = 100
      expect(frame.x).toBe(50)
      expect(frame.y).toBe(100)
    })

    test('resize', () => {
      const api = createAPI()
      const frame = api.createFrame()
      frame.resize(300, 200)
      expect(frame.width).toBe(300)
      expect(frame.height).toBe(200)
    })

    test('fills get/set', () => {
      const api = createAPI()
      const rect = api.createRectangle()
      rect.fills = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
      expect(rect.fills.length).toBe(1)
      expect(rect.fills[0].color.r).toBe(1)
    })

    test('opacity get/set', () => {
      const api = createAPI()
      const frame = api.createFrame()
      frame.opacity = 0.5
      expect(frame.opacity).toBe(0.5)
    })

    test('visible get/set', () => {
      const api = createAPI()
      const frame = api.createFrame()
      frame.visible = false
      expect(frame.visible).toBe(false)
    })

    test('locked get/set', () => {
      const api = createAPI()
      const frame = api.createFrame()
      frame.locked = true
      expect(frame.locked).toBe(true)
    })

    test('rotation get/set', () => {
      const api = createAPI()
      const frame = api.createFrame()
      frame.rotation = 45
      expect(frame.rotation).toBe(45)
    })

    test('clipsContent get/set', () => {
      const api = createAPI()
      const frame = api.createFrame()
      frame.clipsContent = true
      expect(frame.clipsContent).toBe(true)
    })
  })

  describe('corner radius', () => {
    test('uniform corner radius', () => {
      const api = createAPI()
      const rect = api.createRectangle()
      rect.cornerRadius = 8
      expect(rect.cornerRadius).toBe(8)
      expect(rect.topLeftRadius).toBe(8)
      expect(rect.bottomRightRadius).toBe(8)
    })

    test('independent corners return mixed', () => {
      const api = createAPI()
      const rect = api.createRectangle()
      rect.topLeftRadius = 4
      rect.bottomRightRadius = 12
      expect(rect.cornerRadius).toBe(api.mixed)
    })
  })

  describe('text', () => {
    test('characters maps to text content', () => {
      const api = createAPI()
      const text = api.createText()
      text.characters = 'Hello World'
      expect(text.characters).toBe('Hello World')
    })

    test('fontSize get/set', () => {
      const api = createAPI()
      const text = api.createText()
      text.fontSize = 24
      expect(text.fontSize).toBe(24)
    })

    test('fontName get/set', () => {
      const api = createAPI()
      const text = api.createText()
      text.fontName = { family: 'Roboto', style: 'Bold' }
      expect(text.fontName.family).toBe('Roboto')
      expect(text.fontWeight).toBe(700)
    })

    test('fontName italic', () => {
      const api = createAPI()
      const text = api.createText()
      text.fontName = { family: 'Inter', style: 'Bold Italic' }
      expect(text.fontName.family).toBe('Inter')
      expect(text.fontWeight).toBe(700)
      expect(text.fontName.style).toBe('Bold Italic')
    })

    test('textAlignHorizontal', () => {
      const api = createAPI()
      const text = api.createText()
      text.textAlignHorizontal = 'CENTER'
      expect(text.textAlignHorizontal).toBe('CENTER')
    })

    test('textDirection', () => {
      const api = createAPI()
      const text = api.createText()
      text.textDirection = 'RTL'
      expect(text.textDirection).toBe('RTL')
    })

    test('textAutoResize', () => {
      const api = createAPI()
      const text = api.createText()
      text.textAutoResize = 'WIDTH_AND_HEIGHT'
      expect(text.textAutoResize).toBe('WIDTH_AND_HEIGHT')
    })
  })

  describe('auto-layout', () => {
    test('layoutMode', () => {
      const api = createAPI()
      const frame = api.createFrame()
      frame.layoutMode = 'VERTICAL'
      expect(frame.layoutMode).toBe('VERTICAL')
    })

    test('layoutDirection', () => {
      const api = createAPI()
      const frame = api.createFrame()
      expect(frame.layoutDirection).toBe('AUTO')
      frame.layoutDirection = 'RTL'
      expect(frame.layoutDirection).toBe('RTL')
    })

    test('layoutDirection falls back to AUTO for legacy nodes with no stored value', () => {
      const api = createAPI()
      const frame = api.createFrame()
      const raw = api.graph.getNode(frame.id)
      expect(raw).toBeDefined()
      if (!raw) return
      Reflect.deleteProperty(raw as object, 'layoutDirection')
      expect(frame.layoutDirection).toBe('AUTO')
    })

    test('itemSpacing', () => {
      const api = createAPI()
      const frame = api.createFrame()
      frame.layoutMode = 'VERTICAL'
      frame.itemSpacing = 12
      expect(frame.itemSpacing).toBe(12)
    })

    test('padding', () => {
      const api = createAPI()
      const frame = api.createFrame()
      frame.paddingTop = 16
      frame.paddingRight = 24
      frame.paddingBottom = 16
      frame.paddingLeft = 24
      expect(frame.paddingTop).toBe(16)
      expect(frame.paddingRight).toBe(24)
    })

    test('alignment', () => {
      const api = createAPI()
      const frame = api.createFrame()
      frame.layoutMode = 'HORIZONTAL'
      frame.primaryAxisAlignItems = 'SPACE_BETWEEN'
      frame.counterAxisAlignItems = 'CENTER'
      expect(frame.primaryAxisAlignItems).toBe('SPACE_BETWEEN')
      expect(frame.counterAxisAlignItems).toBe('CENTER')
    })

    test('layoutWrap', () => {
      const api = createAPI()
      const frame = api.createFrame()
      frame.layoutWrap = 'WRAP'
      expect(frame.layoutWrap).toBe('WRAP')
    })
  })

  describe('tree operations', () => {
    test('appendChild reparents', () => {
      const api = createAPI()
      const parent = api.createFrame()
      const child = api.createRectangle()
      parent.appendChild(child)
      expect(parent.children.length).toBe(1)
      expect(parent.children[0].id).toBe(child.id)
      expect(child.parent!.id).toBe(parent.id)
    })

    test('insertChild at index', () => {
      const api = createAPI()
      const parent = api.createFrame()
      const a = api.createRectangle()
      const b = api.createRectangle()
      const c = api.createRectangle()
      parent.appendChild(a)
      parent.appendChild(b)
      parent.insertChild(1, c)
      expect(parent.children.map((c) => c.id)).toEqual([a.id, c.id, b.id])
    })

    test('remove deletes node', () => {
      const api = createAPI()
      const frame = api.createFrame()
      const id = frame.id
      frame.remove()
      expect(api.getNodeById(id)).toBeNull()
    })

    test('removed property', () => {
      const api = createAPI()
      const frame = api.createFrame()
      expect(frame.removed).toBe(false)
      frame.remove()
      expect(frame.removed).toBe(true)
    })
  })

  describe('traversal', () => {
    test('findAll finds deep descendants', () => {
      const api = createAPI()
      const parent = api.createFrame()
      parent.name = 'Container'
      const child = api.createFrame()
      child.name = 'Card'
      parent.appendChild(child)
      const text = api.createText()
      text.characters = 'Title'
      text.name = 'Title'
      child.appendChild(text)

      const found = parent.findAll((n) => n.type === 'TEXT')
      expect(found.length).toBe(1)
      expect(found[0].characters).toBe('Title')
    })

    test('findAll without callback returns all', () => {
      const api = createAPI()
      const parent = api.createFrame()
      const a = api.createRectangle()
      const b = api.createText()
      parent.appendChild(a)
      parent.appendChild(b)
      expect(parent.findAll().length).toBe(2)
    })

    test('findOne returns first match', () => {
      const api = createAPI()
      const parent = api.createFrame()
      const a = api.createRectangle()
      a.name = 'First'
      const b = api.createRectangle()
      b.name = 'Second'
      parent.appendChild(a)
      parent.appendChild(b)
      const found = parent.findOne((n) => n.type === 'RECTANGLE')
      expect(found!.name).toBe('First')
    })

    test('findChild searches direct children only', () => {
      const api = createAPI()
      const parent = api.createFrame()
      const child = api.createFrame()
      const deep = api.createText()
      deep.name = 'Deep'
      parent.appendChild(child)
      child.appendChild(deep)

      expect(parent.findChild((n) => n.name === 'Deep')).toBeNull()
      expect(child.findChild((n) => n.name === 'Deep')).not.toBeNull()
    })

    test('findChildren returns direct children matching', () => {
      const api = createAPI()
      const parent = api.createFrame()
      const a = api.createRectangle()
      const b = api.createText()
      const c = api.createRectangle()
      parent.appendChild(a)
      parent.appendChild(b)
      parent.appendChild(c)
      const rects = parent.findChildren((n) => n.type === 'RECTANGLE')
      expect(rects.length).toBe(2)
    })
  })

  describe('grouping', () => {
    test('group creates GROUP with children', () => {
      const api = createAPI()
      const a = api.createRectangle()
      const b = api.createEllipse()
      const group = api.group([a, b], api.currentPage)
      expect(group.type).toBe('GROUP')
      expect(group.children.length).toBe(2)
    })

    test('ungroup dissolves group', () => {
      const api = createAPI()
      const a = api.createRectangle()
      const b = api.createEllipse()
      const group = api.group([a, b], api.currentPage)
      const groupId = group.id
      api.ungroup(group)
      expect(api.getNodeById(groupId)).toBeNull()
      expect(a.parent!.id).toBe(api.currentPage.id)
    })
  })

  describe('selection', () => {
    test('selection get/set', () => {
      const api = createAPI()
      const frame = api.createFrame()
      api.currentPage.selection = [frame]
      expect(api.currentPage.selection.length).toBe(1)
      expect(api.currentPage.selection[0].id).toBe(frame.id)
    })

    test('selection empty by default', () => {
      const api = createAPI()
      expect(api.currentPage.selection).toEqual([])
    })
  })

  describe('components', () => {
    test('createInstance from component', () => {
      const api = createAPI()
      const comp = api.createComponent()
      comp.name = 'Button'
      comp.resize(200, 40)
      const instance = comp.createInstance()
      expect(instance.type).toBe('INSTANCE')
      expect(instance.mainComponent!.id).toBe(comp.id)
    })
  })

  describe('serialization', () => {
    test('toJSON returns clean object', () => {
      const api = createAPI()
      const frame = api.createFrame()
      frame.name = 'Card'
      frame.resize(300, 200)
      frame.fills = [
        { type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }
      ]
      const json = frame.toJSON()
      expect(json.name).toBe('Card')
      expect(json.width).toBe(300)
      expect(json.fills).toBeDefined()
    })

    test('toJSON includes children', () => {
      const api = createAPI()
      const frame = api.createFrame()
      const rect = api.createRectangle()
      frame.appendChild(rect)
      const json = frame.toJSON() as { children?: unknown[] }
      expect(json.children).toBeDefined()
      expect(json.children!.length).toBe(1)
    })

    test('toString returns readable string', () => {
      const api = createAPI()
      const frame = api.createFrame()
      frame.name = 'Card'
      expect(frame.toString()).toContain('FRAME')
      expect(frame.toString()).toContain('Card')
    })
  })

  describe('layout sizing', () => {
    test('child in horizontal parent: h=primary, v=counter', () => {
      const api = createAPI()
      const parent = api.createFrame()
      parent.layoutMode = 'HORIZONTAL'
      const child = api.createFrame()
      parent.appendChild(child)
      child.layoutSizingHorizontal = 'FILL'
      child.layoutSizingVertical = 'HUG'
      expect(child.layoutSizingHorizontal).toBe('FILL')
      expect(child.layoutSizingVertical).toBe('HUG')
    })

    test('child in vertical parent: h=counter, v=primary', () => {
      const api = createAPI()
      const parent = api.createFrame()
      parent.layoutMode = 'VERTICAL'
      const child = api.createFrame()
      parent.appendChild(child)
      child.layoutSizingHorizontal = 'FILL'
      child.layoutSizingVertical = 'HUG'
      expect(child.layoutSizingHorizontal).toBe('FILL')
      expect(child.layoutSizingVertical).toBe('HUG')
    })

    test('auto-layout frame that is also a child of auto-layout', () => {
      const api = createAPI()
      const outer = api.createFrame()
      outer.layoutMode = 'HORIZONTAL'
      const inner = api.createFrame()
      inner.layoutMode = 'VERTICAL'
      outer.appendChild(inner)
      inner.layoutSizingHorizontal = 'FILL'
      expect(inner.layoutSizingHorizontal).toBe('FILL')
      expect(inner.layoutMode).toBe('VERTICAL')
    })

    test('HORIZONTAL child in VERTICAL parent: sizing maps to correct raw axis', () => {
      const api = createAPI()
      const parent = api.createFrame()
      parent.layoutMode = 'VERTICAL'
      parent.resize(375, 812)
      const child = api.createFrame()
      child.layoutMode = 'HORIZONTAL'
      parent.appendChild(child)
      child.layoutSizingVertical = 'FIXED'
      child.resize(375, 44)
      expect(child.layoutSizingVertical).toBe('FIXED')
      const raw = api.graph.getNode(child.id)!
      expect(raw.counterAxisSizing).toBe('FIXED')
    })

    test('VERTICAL child in HORIZONTAL parent: sizing maps to correct raw axis', () => {
      const api = createAPI()
      const parent = api.createFrame()
      parent.layoutMode = 'HORIZONTAL'
      parent.resize(800, 600)
      const child = api.createFrame()
      child.layoutMode = 'VERTICAL'
      parent.appendChild(child)
      child.layoutSizingHorizontal = 'FIXED'
      child.resize(200, 600)
      expect(child.layoutSizingHorizontal).toBe('FIXED')
      const raw = api.graph.getNode(child.id)!
      expect(raw.counterAxisSizing).toBe('FIXED')
    })
  })

  describe('frozen arrays', () => {
    test('fills returns frozen clone', () => {
      const api = createAPI()
      const rect = api.createRectangle()
      rect.fills = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
      const fills = rect.fills
      expect(Object.isFrozen(fills)).toBe(true)
      expect(() => {
        ;(fills as Fill[]).push({} as Fill)
      }).toThrow()
    })

    test('mutating returned fills does not affect node', () => {
      const api = createAPI()
      const rect = api.createRectangle()
      rect.fills = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
      const fills = rect.fills as Fill[]
      try {
        fills[0].color.r = 0
      } catch {}
      expect(rect.fills[0].color.r).toBe(1)
    })
  })

  describe('internals not exposed', () => {
    test('node has no _id, _graph, _api properties', () => {
      const api = createAPI()
      const frame = api.createFrame()
      expect('_id' in frame).toBe(false)
      expect('_graph' in frame).toBe(false)
      expect('_api' in frame).toBe(false)
    })
  })

  describe('stubs', () => {
    test('loadFontAsync resolves', async () => {
      const api = createAPI()
      await api.loadFontAsync({ family: 'Inter', style: 'Regular' })
    })

    test('mixed is a symbol', () => {
      const api = createAPI()
      expect(typeof api.mixed).toBe('symbol')
    })
  })

  describe('absolute position', () => {
    test('absoluteBoundingBox accounts for nesting', () => {
      const api = createAPI()
      const parent = api.createFrame()
      parent.x = 100
      parent.y = 200
      const child = api.createRectangle()
      parent.appendChild(child)
      child.x = 10
      child.y = 20
      child.resize(50, 30)
      const bounds = child.absoluteBoundingBox
      expect(bounds.x).toBe(110)
      expect(bounds.y).toBe(220)
      expect(bounds.width).toBe(50)
      expect(bounds.height).toBe(30)
    })
  })

  describe('stroke details', () => {
    test('strokeWeight and strokeAlign', () => {
      const api = createAPI()
      const rect = api.createRectangle()
      rect.strokes = [
        { color: { r: 0, g: 0, b: 0, a: 1 }, weight: 2, opacity: 1, visible: true, align: 'CENTER' }
      ]
      expect(rect.strokeWeight).toBe(2)
      expect(rect.strokeAlign).toBe('CENTER')
      rect.strokeWeight = 4
      expect(rect.strokeWeight).toBe(4)
    })

    test('strokeCap and strokeJoin', () => {
      const api = createAPI()
      const line = api.createLine()
      expect(line.strokeCap).toBe('NONE')
      expect(line.strokeJoin).toBe('MITER')
      line.strokeCap = 'ROUND'
      line.strokeJoin = 'BEVEL'
      expect(line.strokeCap).toBe('ROUND')
      expect(line.strokeJoin).toBe('BEVEL')
    })

    test('strokeMiterLimit', () => {
      const api = createAPI()
      const rect = api.createRectangle()
      expect(rect.strokeMiterLimit).toBe(4)
      rect.strokeMiterLimit = 8
      expect(rect.strokeMiterLimit).toBe(8)
    })

    test('individual stroke weights', () => {
      const api = createAPI()
      const frame = api.createFrame()
      frame.strokeTopWeight = 1
      frame.strokeRightWeight = 2
      frame.strokeBottomWeight = 3
      frame.strokeLeftWeight = 4
      expect(frame.strokeTopWeight).toBe(1)
      expect(frame.strokeRightWeight).toBe(2)
      expect(frame.strokeBottomWeight).toBe(3)
      expect(frame.strokeLeftWeight).toBe(4)
    })
  })

  describe('clone', () => {
    test('clone creates a deep copy', () => {
      const api = createAPI()
      const frame = api.createFrame()
      frame.name = 'Original'
      frame.fills = [
        { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
      ]
      const child = api.createRectangle()
      child.name = 'Child'
      frame.appendChild(child)

      const cloned = frame.clone()
      expect(cloned.id).not.toBe(frame.id)
      expect(cloned.name).toBe('Original')
      expect(cloned.fills[0].color.r).toBe(1)
      expect(cloned.children.length).toBe(1)
      expect(cloned.children[0].name).toBe('Child')
      expect(cloned.children[0].id).not.toBe(child.id)
    })
  })

  describe('min/max dimensions', () => {
    test('defaults to null', () => {
      const api = createAPI()
      const frame = api.createFrame()
      expect(frame.minWidth).toBeNull()
      expect(frame.maxWidth).toBeNull()
      expect(frame.minHeight).toBeNull()
      expect(frame.maxHeight).toBeNull()
    })

    test('can set and read', () => {
      const api = createAPI()
      const frame = api.createFrame()
      frame.minWidth = 50
      frame.maxWidth = 400
      frame.minHeight = 30
      frame.maxHeight = 600
      expect(frame.minWidth).toBe(50)
      expect(frame.maxWidth).toBe(400)
      expect(frame.minHeight).toBe(30)
      expect(frame.maxHeight).toBe(600)
    })

    test('can reset to null', () => {
      const api = createAPI()
      const frame = api.createFrame()
      frame.minWidth = 50
      frame.minWidth = null
      expect(frame.minWidth).toBeNull()
    })
  })

  describe('mask', () => {
    test('isMask defaults to false', () => {
      const api = createAPI()
      const rect = api.createRectangle()
      expect(rect.isMask).toBe(false)
      expect(rect.maskType).toBe('ALPHA')
    })

    test('can set mask properties', () => {
      const api = createAPI()
      const rect = api.createRectangle()
      rect.isMask = true
      rect.maskType = 'LUMINANCE'
      expect(rect.isMask).toBe(true)
      expect(rect.maskType).toBe('LUMINANCE')
    })
  })

  describe('auto-layout extras', () => {
    test('primaryAxisSizingMode maps FIXED/AUTO', () => {
      const api = createAPI()
      const frame = api.createFrame()
      frame.layoutMode = 'VERTICAL'
      expect(frame.primaryAxisSizingMode).toBe('FIXED')
      frame.primaryAxisSizingMode = 'AUTO'
      expect(frame.primaryAxisSizingMode).toBe('AUTO')
      expect(frame.layoutSizingVertical).toBe('HUG')
    })

    test('counterAxisSizingMode maps FIXED/AUTO', () => {
      const api = createAPI()
      const frame = api.createFrame()
      frame.layoutMode = 'VERTICAL'
      frame.counterAxisSizingMode = 'AUTO'
      expect(frame.counterAxisSizingMode).toBe('AUTO')
      expect(frame.layoutSizingHorizontal).toBe('HUG')
    })

    test('counterAxisAlignContent', () => {
      const api = createAPI()
      const frame = api.createFrame()
      expect(frame.counterAxisAlignContent).toBe('AUTO')
      frame.counterAxisAlignContent = 'SPACE_BETWEEN'
      expect(frame.counterAxisAlignContent).toBe('SPACE_BETWEEN')
    })

    test('itemReverseZIndex', () => {
      const api = createAPI()
      const frame = api.createFrame()
      expect(frame.itemReverseZIndex).toBe(false)
      frame.itemReverseZIndex = true
      expect(frame.itemReverseZIndex).toBe(true)
    })

    test('strokesIncludedInLayout', () => {
      const api = createAPI()
      const frame = api.createFrame()
      expect(frame.strokesIncludedInLayout).toBe(false)
      frame.strokesIncludedInLayout = true
      expect(frame.strokesIncludedInLayout).toBe(true)
    })

    test('layoutAlign maps to layoutAlignSelf', () => {
      const api = createAPI()
      const parent = api.createFrame()
      parent.layoutMode = 'VERTICAL'
      const child = api.createFrame()
      parent.appendChild(child)
      expect(child.layoutAlign).toBe('INHERIT')
      child.layoutAlign = 'STRETCH'
      expect(child.layoutAlign).toBe('STRETCH')
    })
  })

  describe('text extras', () => {
    test('textTruncation', () => {
      const api = createAPI()
      const text = api.createText()
      expect(text.textTruncation).toBe('DISABLED')
      text.textTruncation = 'ENDING'
      expect(text.textTruncation).toBe('ENDING')
    })

    test('autoRename', () => {
      const api = createAPI()
      const text = api.createText()
      expect(text.autoRename).toBe(true)
      text.autoRename = false
      expect(text.autoRename).toBe(false)
    })

    test('insertCharacters', () => {
      const api = createAPI()
      const text = api.createText()
      text.characters = 'Hello World'
      text.insertCharacters(5, ' Beautiful')
      expect(text.characters).toBe('Hello Beautiful World')
    })

    test('deleteCharacters', () => {
      const api = createAPI()
      const text = api.createText()
      text.characters = 'Hello Beautiful World'
      text.deleteCharacters(5, 15)
      expect(text.characters).toBe('Hello World')
    })
  })

  describe('expanded', () => {
    test('defaults to true', () => {
      const api = createAPI()
      const frame = api.createFrame()
      expect(frame.expanded).toBe(true)
    })

    test('can collapse', () => {
      const api = createAPI()
      const frame = api.createFrame()
      frame.expanded = false
      expect(frame.expanded).toBe(false)
    })
  })

  describe('findAllWithCriteria', () => {
    test('filters by type', () => {
      const api = createAPI()
      api.createFrame()
      api.createRectangle()
      api.createText()
      api.createRectangle()
      const rects = api.currentPage.findAllWithCriteria({ types: ['RECTANGLE'] })
      expect(rects.length).toBe(2)
      expect(rects.every((n) => n.type === 'RECTANGLE')).toBe(true)
    })

    test('filters by multiple types', () => {
      const api = createAPI()
      api.createFrame()
      api.createRectangle()
      api.createText()
      const result = api.currentPage.findAllWithCriteria({ types: ['FRAME', 'TEXT'] })
      expect(result.length).toBe(2)
    })
  })

  describe('createComponentFromNode', () => {
    test('converts frame to component', () => {
      const api = createAPI()
      const frame = api.createFrame()
      frame.name = 'MyButton'
      frame.resize(200, 50)
      const child = api.createRectangle()
      child.name = 'Background'
      frame.appendChild(child)
      const frameId = frame.id

      const comp = api.createComponentFromNode(frame)
      expect(comp.type).toBe('COMPONENT')
      expect(comp.name).toBe('MyButton')
      expect(comp.width).toBe(200)
      expect(comp.height).toBe(50)
      expect(comp.children.length).toBe(1)
      expect(comp.children[0].name).toBe('Background')
      expect(api.getNodeById(frameId)).toBeNull()
    })
  })

  describe('variables', () => {
    test('getLocalVariables returns empty by default', () => {
      const api = createAPI()
      expect(api.getLocalVariables()).toEqual([])
    })

    test('getLocalVariables returns added variables', () => {
      const api = createAPI()
      api.graph.addCollection({
        id: 'col1',
        name: 'Colors',
        modes: [{ modeId: 'mode1', name: 'Default' }],
        defaultModeId: 'mode1',
        variableIds: []
      })
      api.graph.addVariable({
        id: 'var1',
        name: 'primary',
        type: 'COLOR',
        collectionId: 'col1',
        valuesByMode: { mode1: { r: 1, g: 0, b: 0, a: 1 } },
        description: '',
        hiddenFromPublishing: false
      })
      expect(api.getLocalVariables().length).toBe(1)
      expect(api.getLocalVariables('COLOR').length).toBe(1)
      expect(api.getLocalVariables('FLOAT').length).toBe(0)
    })

    test('getVariableById', () => {
      const api = createAPI()
      api.graph.addCollection({
        id: 'col1',
        name: 'Spacing',
        modes: [{ modeId: 'mode1', name: 'Default' }],
        defaultModeId: 'mode1',
        variableIds: []
      })
      api.graph.addVariable({
        id: 'var1',
        name: 'spacing-sm',
        type: 'FLOAT',
        collectionId: 'col1',
        valuesByMode: { mode1: 8 },
        description: '',
        hiddenFromPublishing: false
      })
      const v = api.getVariableById('var1')
      expect(v).not.toBeNull()
      expect(v!.name).toBe('spacing-sm')
      expect(api.getVariableById('nonexistent')).toBeNull()
    })

    test('getLocalVariableCollections', () => {
      const api = createAPI()
      api.graph.addCollection({
        id: 'col1',
        name: 'Colors',
        modes: [{ modeId: 'mode1', name: 'Default' }],
        defaultModeId: 'mode1',
        variableIds: []
      })
      const cols = api.getLocalVariableCollections()
      expect(cols.length).toBe(1)
      expect(cols[0].name).toBe('Colors')
    })

    test('getVariableCollectionById', () => {
      const api = createAPI()
      api.graph.addCollection({
        id: 'col1',
        name: 'Colors',
        modes: [{ modeId: 'mode1', name: 'Default' }],
        defaultModeId: 'mode1',
        variableIds: []
      })
      expect(api.getVariableCollectionById('col1')?.name).toBe('Colors')
      expect(api.getVariableCollectionById('nonexistent')).toBeNull()
    })
  })
})
