import { describe, expect, test } from 'bun:test'

import { deflateSync } from 'fflate'
import { fromUint8Array } from 'js-base64'

import { MAX_INFLATED_BYTES, parseDrawioFile, readDrawioBytes } from '@open-pencil/drawio'

/**
 * A page as draw.io saves it: the root and default layer, a second hidden layer, a plain shape,
 * a shape wrapped in a `UserObject`, an edge with bend points between them, and a label moved
 * along that edge, which draw.io keeps as a relative child of the edge.
 */
const MODEL = `<mxGraphModel dx="1018" dy="616" grid="1" gridSize="10" background="#ffffff">
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="notes" value="Notes" style="locked=1;" parent="0" visible="0"/>
    <mxCell id="a" value="Start" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;" vertex="1" parent="1">
      <mxGeometry x="40" y="60" width="120" height="60" as="geometry"/>
    </mxCell>
    <UserObject label="&lt;b&gt;Done&lt;/b&gt;" tooltip="Why" link="https://example.com" id="b">
      <mxCell style="ellipse;whiteSpace=wrap;html=1;" vertex="1" parent="1">
        <mxGeometry x="320" y="200" width="120" height="80" as="geometry"/>
      </mxCell>
    </UserObject>
    <mxCell id="e" value="" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=block;" edge="1" parent="1" source="a" target="b">
      <mxGeometry relative="1" as="geometry">
        <Array as="points"><mxPoint x="240" y="90"/><mxPoint x="240" y="240"/></Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="l" value="next" style="edgeLabel;html=1;align=center;" vertex="1" connectable="0" parent="e">
      <mxGeometry x="-0.3" y="2" relative="1" as="geometry"><mxPoint x="4" y="-6" as="offset"/></mxGeometry>
    </mxCell>
    <mxCell id="hidden" value="Draft" style="text;" vertex="1" parent="notes" visible="0">
      <mxGeometry x="10" y="10" width="60" height="20" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>`

const page = (name: string, model = MODEL) => `<diagram id="${name}" name="${name}">${model}</diagram>`

/** A page as draw.io compresses it: the model percent-encoded, raw-deflated, then Base64. */
function compressed(model: string): string {
  const raw = new TextEncoder().encode(encodeURIComponent(model))
  return fromUint8Array(deflateSync(raw, { level: 9 }))
}

describe('reading a draw.io file', () => {
  test('keeps each page’s layers, cells in drawing order, styles, and geometry', () => {
    const file = parseDrawioFile(`<mxfile host="drawio">${page('First')}</mxfile>`)
    const [first] = file?.pages ?? []
    expect(first).toMatchObject({
      name: 'First',
      rootId: '0',
      attributes: { grid: '1', background: '#ffffff' },
      layers: [
        { id: '1', name: '', visible: true, locked: false },
        { id: 'notes', name: 'Notes', visible: false, locked: true }
      ]
    })
    expect(first?.cells.map((cell) => [cell.id, cell.kind, cell.parent])).toEqual([
      ['a', 'vertex', '1'],
      ['b', 'vertex', '1'],
      ['e', 'edge', '1'],
      ['l', 'vertex', 'e'],
      ['hidden', 'vertex', 'notes']
    ])
    const [start, done, edge, label, hidden] = first?.cells ?? []
    expect(start.style).toEqual({
      names: [],
      values: { rounded: '1', whiteSpace: 'wrap', html: '1', fillColor: '#dae8fc' }
    })
    expect(done).toMatchObject({
      value: '<b>Done</b>',
      style: { names: ['ellipse'] },
      attributes: { tooltip: 'Why', link: 'https://example.com' }
    })
    expect(edge).toMatchObject({ source: 'a', target: 'b' })
    expect(edge.geometry.points).toEqual([
      { x: 240, y: 90 },
      { x: 240, y: 240 }
    ])
    expect(label.geometry).toMatchObject({ x: -0.3, y: 2, relative: true, offset: { x: 4, y: -6 } })
    expect(hidden.visible).toBe(false)
  })

  test('reads a bare model and compressed pages', () => {
    expect(parseDrawioFile(MODEL)?.pages[0]?.cells).toHaveLength(5)
    const file = parseDrawioFile(
      `<mxfile><diagram id="z" name="Packed">${compressed(MODEL)}</diagram></mxfile>`
    )
    expect(file?.pages[0]?.cells.map((cell) => cell.id)).toEqual(['a', 'b', 'e', 'l', 'hidden'])
  })

  test('names pages it cannot read, and reads the rest', () => {
    const file = parseDrawioFile(
      `<mxfile>${page('Good')}<diagram id="bad" name="Broken">not base64 %%%</diagram></mxfile>`
    )
    expect(file?.pages.map((p) => p.name)).toEqual(['Good'])
    expect(file?.unreadable).toEqual(['Broken'])
  })

  test('is not fooled by other XML', () => {
    expect(parseDrawioFile('<svg xmlns="http://www.w3.org/2000/svg"/>')).toBeNull()
    expect(parseDrawioFile('not xml')).toBeNull()
  })

  test('stops unpacking once the whole file passes its limit, however many pages share it', () => {
    // Each page alone unpacks within the limit; together they do not.
    const big = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0" value="${'x'.repeat(
      MAX_INFLATED_BYTES / 4
    )}"/></root></mxGraphModel>`
    const packed = compressed(big)
    const pages = Array.from({ length: 6 }, (_, i) => `<diagram id="p${i}" name="P${i}">${packed}</diagram>`)
    const file = parseDrawioFile(`<mxfile>${pages.join('')}</mxfile>`)
    expect(file?.pages.length).toBeLessThan(6)
    expect(file?.unreadable.length).toBeGreaterThan(0)
  })
})

/** A PNG holding only the chunk draw.io adds: its signature, a `tEXt` chunk, and `IEND`. */
function pngWithText(keyword: string, text: string): Uint8Array {
  const latin1 = (value: string) => Uint8Array.from(value, (c) => c.charCodeAt(0))
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length)
    new DataView(out.buffer).setUint32(0, data.length)
    out.set(latin1(type), 4)
    out.set(data, 8)
    return out
  }
  const body = latin1(`${keyword}\0${encodeURIComponent(text)}`)
  const parts = [
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('tEXt', body),
    chunk('IEND', new Uint8Array())
  ]
  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    bytes.set(part, offset)
    offset += part.length
  }
  return bytes
}

describe('reading the diagram a draw.io export embeds', () => {
  test('from a PNG’s text chunk', () => {
    const file = readDrawioBytes(pngWithText('mxfile', `<mxfile>${page('Embedded')}</mxfile>`))
    expect(file?.pages[0]?.name).toBe('Embedded')
    expect(readDrawioBytes(pngWithText('Software', 'paint.net'))).toBeNull()
  })

  test('from an SVG’s content attribute', () => {
    const content = `<mxfile>${page('Vector')}</mxfile>`
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
    const svg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" content="${content}"><rect/></svg>`
    expect(readDrawioBytes(new TextEncoder().encode(svg))?.pages[0]?.name).toBe('Vector')
    expect(readDrawioBytes(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull()
  })
})
