import { describe, expect, test } from 'bun:test'

import { deflateSync } from 'fflate'
import { fromUint8Array } from 'js-base64'

import { BUILTIN_IO_FORMATS, IORegistry } from '#core/io'
import { parseDrawioFile } from '#core/io/formats/drawio/document'
import { readDrawioDocument } from '#core/io/formats/drawio'
import { parseLabel } from '#core/io/formats/drawio/label'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

const io = new IORegistry(BUILTIN_IO_FORMATS)

const BASE = {
  bold: false,
  italic: false,
  underline: false,
  size: 12,
  color: '#000000',
  family: 'Inter'
}

const MODEL = `<mxGraphModel><root>
  <mxCell id="0"/><mxCell id="1" parent="0"/>
  <mxCell id="a" value="Alpha" style="rounded=1;arcSize=10;fillColor=#dbeafe;strokeColor=#15803d;strokeWidth=3;dashed=1;fontSize=20;fontColor=#0b1b3f;" vertex="1" parent="1">
    <mxGeometry x="40" y="60" width="200" height="100" as="geometry"/>
  </mxCell>
  <UserObject id="b" label="&lt;b&gt;Beta&lt;/b&gt;&lt;br&gt;second line" tooltip="Why it exists" link="data:page/id,why">
    <mxCell style="ellipse;html=1;fillColor=#fef3c7;strokeColor=none;" vertex="1" parent="1">
      <mxGeometry x="400" y="60" width="160" height="100" as="geometry"/>
    </mxCell>
  </UserObject>
  <mxCell id="c" value="Store" style="shape=cylinder3;size=12;fillColor=#ede9fe;strokeColor=#475569;" vertex="1" parent="1">
    <mxGeometry x="40" y="300" width="120" height="140" as="geometry"/>
  </mxCell>
  <mxCell id="d" value="Choice" style="rhombus;fillColor=#fde2e4;" vertex="1" parent="1">
    <mxGeometry x="400" y="300" width="160" height="120" as="geometry"/>
  </mxCell>
  <mxCell id="e" value="goes" style="edgeStyle=orthogonalEdgeStyle;rounded=1;endArrow=block;startArrow=open;strokeWidth=3;labelBackgroundColor=#ffffff;" edge="1" parent="1" source="a" target="b">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
  <mxCell id="f" value="" style="endArrow=none;" edge="1" parent="1" source="c" target="d">
    <mxGeometry relative="1" as="geometry"><Array as="points"><mxPoint x="100" y="520"/><mxPoint x="480" y="520"/></Array></mxGeometry>
  </mxCell>
</root></mxGraphModel>`

const FILE = `<mxfile><diagram id="p1" name="First">${MODEL}</diagram><diagram id="p2" name="Second">${MODEL}</diagram></mxfile>`

function compressed(model: string): string {
  const raw = new TextEncoder().encode(encodeURIComponent(model))
  return `<mxfile><diagram id="z" name="Packed">${fromUint8Array(deflateSync(raw, { level: 9 }))}</diagram></mxfile>`
}

function load(source = FILE): SceneGraph {
  const graph = readDrawioDocument(source)
  if (!graph) throw new Error('not a draw.io file')
  return graph
}

function child(graph: SceneGraph, parent: SceneNode | undefined, name: string): SceneNode {
  const found = parent?.childIds
    .map((id) => graph.getNode(id))
    .find((node) => node?.name === name)
  if (!found) throw new Error(`no layer named ${name}`)
  return found
}

function firstPage(graph: SceneGraph): SceneNode {
  return graph.getPages()[0]
}

function data(node: SceneNode, key: string): string | undefined {
  return node.pluginData.find((entry) => entry.key === key)?.value
}

describe('pages', () => {
  test('each draw.io page becomes a page with the same name and order', () => {
    expect(load().getPages().map((page) => page.name)).toEqual(['First', 'Second'])
  })

  test('a compressed diagram reads like a plain one', () => {
    const graph = load(compressed(MODEL))
    expect(graph.getPages().map((page) => page.name)).toEqual(['Packed'])
    expect(firstPage(graph).childIds.length).toBeGreaterThan(0)
  })

  test('a compressed page with a stray percent sign still opens', () => {
    const raw = new TextEncoder().encode(MODEL.replace('goes', '50% done'))
    const packed = fromUint8Array(deflateSync(raw, { level: 9 }))
    const source = `<mxfile><diagram id="z" name="Packed">${packed}</diagram></mxfile>`
    const page = firstPage(load(source))
    expect(page.name).toBe('Packed')
    expect(page.childIds.length).toBeGreaterThan(0)
  })

  test('a compressed page with a stray percent sign keeps its other escapes', () => {
    const encoded = encodeURIComponent(MODEL).replace('goes', '50%25 done').replace('50%25', '50%')
    const packed = fromUint8Array(deflateSync(new TextEncoder().encode(encoded), { level: 9 }))
    const source = `<mxfile><diagram id="z" name="Packed">${packed}</diagram></mxfile>`
    const graph = load(source)
    expect(child(graph, firstPage(graph), 'Arrow: 50% done')).toBeDefined()
  })

  test('a compressed page that unpacks past the size limit fails the import', () => {
    const bomb = new Uint8Array(32 * 1024 * 1024 + 1).fill(32)
    const packed = fromUint8Array(deflateSync(bomb, { level: 9 }))
    const source = `<mxfile><diagram id="p1" name="First">${MODEL}</diagram><diagram id="x" name="Huge">${packed}</diagram></mxfile>`
    expect(() => readDrawioDocument(source)).toThrow('Could not read these draw.io pages: Huge')
    // Unpacking 32 MiB to find the limit takes a few seconds on a busy machine.
  }, 30_000)

  test('a bare mxGraphModel is one page', () => {
    expect(parseDrawioFile(MODEL)?.pages.map((page) => page.name)).toEqual(['Page 1'])
  })

  test('something that is not a draw.io diagram is refused', () => {
    expect(parseDrawioFile('<svg xmlns="http://www.w3.org/2000/svg"/>')).toBeNull()
    expect(parseDrawioFile('not xml <')).toBeNull()
  })
})

describe('boxes', () => {
  test('a rounded box keeps its position, fill, border, dashes and radius', () => {
    const graph = load()
    const box = child(graph, firstPage(graph), 'Alpha')
    expect(box.type).toBe('FRAME')
    expect([box.x, box.y, box.width, box.height]).toEqual([40, 60, 200, 100])
    expect(box.cornerRadius).toBe(10)
    expect(box.fills[0].color.b).toBeGreaterThan(0.9)
    expect(box.strokes[0].weight).toBe(3)
    expect(box.strokes[0].dashPattern).toEqual([9, 9])
    // The file format keeps dashes on the layer, so the layer carries them too.
    expect(box.dashPattern).toEqual([9, 9])
  })

  test('the draw.io id, tooltip and link stay on the layer', () => {
    const graph = load()
    const box = child(graph, firstPage(graph), 'Beta')
    expect(data(box, 'drawio-id')).toBe('b')
    expect(data(box, 'drawio-tooltip')).toBe('Why it exists')
    expect(data(box, 'drawio-link')).toBe('data:page/id,why')
  })

  test('a border of none draws no border', () => {
    const graph = load()
    const shape = child(graph, child(graph, firstPage(graph), 'Beta'), 'Shape')
    expect(shape.type).toBe('ELLIPSE')
    expect(shape.strokes).toEqual([])
  })

  test('a box inside a container is the container\'s child at the same place', () => {
    const graph = load(`<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
      <mxCell id="inner" value="Inner" style="rounded=0;" vertex="1" parent="lane">
        <mxGeometry x="20" y="40" width="80" height="30" as="geometry"/>
      </mxCell>
      <mxCell id="lane" value="Lane" style="swimlane;" vertex="1" parent="1">
        <mxGeometry x="100" y="50" width="300" height="200" as="geometry"/>
      </mxCell>
    </root></mxGraphModel>`)
    const lane = child(graph, firstPage(graph), 'Lane')
    const inner = child(graph, lane, 'Inner')
    expect([lane.x, lane.y, inner.x, inner.y]).toEqual([100, 50, 20, 40])
  })

  test('cylinders and diamonds are vectors with their own outline', () => {
    const graph = load()
    const store = child(graph, child(graph, firstPage(graph), 'Store'), 'Shape')
    const choice = child(graph, child(graph, firstPage(graph), 'Choice'), 'Shape')
    expect(store.type).toBe('VECTOR')
    expect(store.vectorNetwork?.segments.length).toBeGreaterThan(4)
    expect(choice.vectorNetwork?.vertices).toHaveLength(4)
  })
})

describe('labels', () => {
  test('a box label sits inside the box as one text layer', () => {
    const graph = load()
    const text = child(graph, child(graph, firstPage(graph), 'Alpha'), 'Alpha')
    expect(text.type).toBe('TEXT')
    expect(text.text).toBe('Alpha')
    expect(text.fontSize).toBe(20)
    expect(text.textAlignHorizontal).toBe('CENTER')
    expect(text.textAlignVertical).toBe('CENTER')
    expect(text.width).toBe(196)
  })

  test('HTML keeps its lines and the bold word', () => {
    const label = parseLabel('<b>Beta</b><br>second line', true, BASE)
    expect(label.text).toBe('Beta\nsecond line')
    expect(label.runs).toEqual([{ start: 0, length: 4, style: { fontWeight: 700 } }])
  })

  test('divs and spans carry sizes and colours as runs', () => {
    const label = parseLabel(
      "<div><b style='font-size:30px'>Title</b></div><div><span style='color:#ff0000'>red</span> plain</div>",
      true,
      BASE
    )
    expect(label.text).toBe('Title\nred plain')
    expect(label.runs[0].style).toMatchObject({ fontWeight: 700, fontSize: 30 })
    expect(label.runs[1].style.fills?.[0].color.r).toBe(1)
    expect(label.runs[1]).toMatchObject({ start: 6, length: 3 })
  })

  test('entities become characters and plain labels stay plain', () => {
    expect(parseLabel('a &amp; b &lt;c&gt; &#8377;', true, BASE).text).toBe('a & b <c> ₹')
    expect(parseLabel('<not html>', false, BASE)).toEqual({ text: '<not html>', runs: [] })
  })

  test('a plain run inside a bold label is set back to regular weight', () => {
    const label = parseLabel('<span style="font-weight:normal">light</span>', true, {
      ...BASE,
      bold: true
    })
    expect(label.runs[0].style.fontWeight).toBe(400)
  })
})

describe('arrows', () => {
  test('an arrow between boxes becomes a line with arrowheads and a label', () => {
    const graph = load()
    const arrow = child(graph, firstPage(graph), 'Arrow: goes')
    const line = child(graph, arrow, 'Line')
    const vertices = line.vectorNetwork?.vertices ?? []
    expect(vertices[0].strokeCap).toBe('ARROW_LINES')
    expect(vertices[vertices.length - 1].strokeCap).toBe('ARROW_EQUILATERAL')
    expect(line.strokes[0].weight).toBe(3)
    expect(child(graph, arrow, 'Label').fills).toHaveLength(1)
    expect(data(arrow, 'drawio-id')).toBe('e')
  })

  test('the line leaves the facing sides of the two boxes', () => {
    const graph = load()
    const arrow = child(graph, firstPage(graph), 'Arrow: goes')
    // Alpha's right edge is x=240; Beta's left edge is x=400.
    expect(arrow.x).toBe(240)
    expect(arrow.x + arrow.width).toBe(400)
  })

  test('an arrow with loose ends runs from its source point to its target point', () => {
    const graph = load(`<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
      <mxCell id="e" value="" style="endArrow=classic;" edge="1" parent="1">
        <mxGeometry relative="1" as="geometry">
          <mxPoint x="10" y="20" as="sourcePoint"/><mxPoint x="110" y="20" as="targetPoint"/>
        </mxGeometry>
      </mxCell>
    </root></mxGraphModel>`)
    const arrow = child(graph, firstPage(graph), 'Arrow')
    expect([arrow.x, arrow.y, arrow.width, arrow.height]).toEqual([10, 20, 100, 0])
  })

  test('waypoints are kept and an arrow with no head has no cap', () => {
    const graph = load()
    const arrow = child(graph, firstPage(graph), 'Arrow')
    const line = child(graph, arrow, 'Line')
    const vertices = line.vectorNetwork?.vertices ?? []
    expect(vertices.length).toBeGreaterThanOrEqual(4)
    expect(vertices.every((vertex) => !vertex.strokeCap)).toBe(true)
    expect(arrow.y + arrow.height).toBe(520)
  })
})

describe('format', () => {
  test('.drawio files are found by name and read through the registry', async () => {
    expect(io.findReader('system.drawio')?.id).toBe('drawio')
    const { graph, sourceFormat } = await io.readDocument({
      name: 'system.drawio',
      data: new TextEncoder().encode(FILE)
    })
    expect(sourceFormat).toBe('drawio')
    expect(graph.getPages()).toHaveLength(2)
  })

  test('a draw.io file cannot be written back', () => {
    expect(io.getFormat('drawio')?.support.writeDocument).toBeUndefined()
  })

  test('a file that is not a diagram is an error, not an empty document', async () => {
    await expect(
      io.readDocument({ name: 'x.drawio', data: new TextEncoder().encode('<html/>') })
    ).rejects.toThrow('Not a draw.io diagram')
  })
})
