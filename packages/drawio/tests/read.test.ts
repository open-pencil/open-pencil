import { describe, expect, test } from 'bun:test'

import { deflateSync } from 'fflate'
import { fromUint8Array } from 'js-base64'

import { MAX_INFLATED_BYTES, parseDrawIOFile, readDrawIOBytes } from '@open-pencil/drawio'

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

const page = (name: string, model = MODEL) =>
  `<diagram id="${name}" name="${name}">${model}</diagram>`

/** A page as draw.io compresses it: the model percent-encoded, raw-deflated, then Base64. */
function compressed(model: string): string {
  const raw = new TextEncoder().encode(encodeURIComponent(model))
  return fromUint8Array(deflateSync(raw, { level: 9 }))
}

describe('reading a draw.io file', () => {
  test('keeps each page’s layers, cells in drawing order, styles, and geometry', () => {
    const file = parseDrawIOFile(`<mxfile host="drawio">${page('First')}</mxfile>`)
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
    expect(parseDrawIOFile(MODEL)?.pages[0]?.cells).toHaveLength(5)
    const file = parseDrawIOFile(
      `<mxfile><diagram id="z" name="Packed">${compressed(MODEL)}</diagram></mxfile>`
    )
    expect(file?.pages[0]?.cells.map((cell) => cell.id)).toEqual(['a', 'b', 'e', 'l', 'hidden'])
  })

  test('names pages it cannot read, and reads the rest', () => {
    const file = parseDrawIOFile(
      `<mxfile>${page('Good')}<diagram id="bad" name="Broken">not base64 %%%</diagram></mxfile>`
    )
    expect(file?.pages.map((p) => p.name)).toEqual(['Good'])
    expect(file?.unreadable).toEqual(['Broken'])
  })

  test('is not fooled by other XML', () => {
    expect(parseDrawIOFile('<svg xmlns="http://www.w3.org/2000/svg"/>')).toBeNull()
    expect(parseDrawIOFile('not xml')).toBeNull()
  })

  test('stops unpacking once the whole file passes its limit, however many pages share it', () => {
    // Each page alone unpacks within the limit; together they do not.
    const big = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0" value="${'x'.repeat(
      MAX_INFLATED_BYTES / 4
    )}"/></root></mxGraphModel>`
    const packed = compressed(big)
    const pages = Array.from(
      { length: 6 },
      (_, i) => `<diagram id="p${i}" name="P${i}">${packed}</diagram>`
    )
    const file = parseDrawIOFile(`<mxfile>${pages.join('')}</mxfile>`)
    expect(file?.pages.length).toBeLessThan(6)
    expect(file?.unreadable.length).toBeGreaterThan(0)
  })
})

const latin1 = (value: string) => Uint8Array.from(value, (c) => c.charCodeAt(0))

function concat(parts: Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    bytes.set(part, offset)
    offset += part.length
  }
  return bytes
}

/** A PNG chunk: its length, type, data, and a CRC, which the reader does not check. */
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  new DataView(out.buffer).setUint32(0, data.length)
  out.set(latin1(type), 4)
  out.set(data, 8)
  return out
}

/** A 1 × 1 PNG holding the given chunks between its `IHDR` and `IEND`. */
function png(...chunks: Uint8Array[]): Uint8Array {
  const signature = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  // Width and height 1, bit depth 8, color type 6 (RGBA), default compression, filter, interlace.
  const header = Uint8Array.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])
  return concat([signature, chunk('IHDR', header), ...chunks, chunk('IEND', new Uint8Array())])
}

/** A PNG holding only the chunk draw.io adds: a `tEXt` chunk under `keyword`. */
function pngWithText(keyword: string, text: string): Uint8Array {
  return png(chunk('tEXt', latin1(`${keyword}\0${encodeURIComponent(text)}`)))
}

/** A zlib stream of `text`: a 2-byte header, then raw deflate, as PNG text chunks hold it. */
function zlib(text: string): Uint8Array {
  return concat([Uint8Array.from([0x78, 0xda]), deflateSync(latin1(text), { level: 9 })])
}

const EMBEDDED = encodeURIComponent(`<mxfile>${page('Embedded')}</mxfile>`)

describe('reading the diagram a draw.io export embeds', () => {
  test('from a PNG’s text chunk', () => {
    const file = readDrawIOBytes(pngWithText('mxfile', `<mxfile>${page('Embedded')}</mxfile>`))
    expect(file?.pages[0]?.name).toBe('Embedded')
    expect(readDrawIOBytes(pngWithText('Software', 'paint.net'))).toBeNull()
  })

  test('from an SVG’s content attribute', () => {
    const content = `<mxfile>${page('Vector')}</mxfile>`
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
    const svg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" content="${content}"><rect/></svg>`
    expect(readDrawIOBytes(new TextEncoder().encode(svg))?.pages[0]?.name).toBe('Vector')
    expect(
      readDrawIOBytes(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))
    ).toBeNull()
  })

  test('from a PNG’s compressed and international text chunks', () => {
    const zTXt = png(chunk('zTXt', concat([latin1('mxfile\0\0'), zlib(EMBEDDED)])))
    expect(readDrawIOBytes(zTXt)?.pages[0]?.name).toBe('Embedded')
    // iTXt: keyword, compression flag and method, then empty language and translated keyword.
    const packed = png(chunk('iTXt', concat([latin1('mxfile\0\x01\0\0\0'), zlib(EMBEDDED)])))
    expect(readDrawIOBytes(packed)?.pages[0]?.name).toBe('Embedded')
    const plain = png(chunk('iTXt', latin1(`mxfile\0\0\0\0\0${EMBEDDED}`)))
    expect(readDrawIOBytes(plain)?.pages[0]?.name).toBe('Embedded')
  })

  test('says a damaged or cut short PNG cannot be read, rather than that it holds no diagram', () => {
    const damaged = png(chunk('zTXt', latin1('mxfile\0\0not zlib')))
    expect(() => readDrawIOBytes(damaged)).toThrow(
      'Could not read the draw.io diagram in this image'
    )
    const whole = pngWithText('mxfile', `<mxfile>${page('Embedded')}</mxfile>`)
    // Dropping `IEND`, the text chunk's CRC, and a few bytes of its data.
    expect(() => readDrawIOBytes(whole.subarray(0, -20))).toThrow('cut short')
  })

  test('counts what a PNG’s chunk unpacks to against the limit its pages share', () => {
    // The chunk and each page unpack within the limit; the chunk and both pages do not.
    const model = (share: number) =>
      `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0" value="${'x'.repeat(
        MAX_INFLATED_BYTES * share
      )}"/></root></mxGraphModel>`
    const packed = compressed(model(0.3))
    const pages = ['First', 'Second'].map(
      (name) => `<diagram id="${name}" name="${name}">${packed}</diagram>`
    )
    const padding = 'x'.repeat(MAX_INFLATED_BYTES * 0.5)
    const embedded = encodeURIComponent(`<mxfile padding="${padding}">${pages.join('')}</mxfile>`)
    const file = readDrawIOBytes(png(chunk('zTXt', concat([latin1('mxfile\0\0'), zlib(embedded)]))))
    expect(file?.pages.map((p) => p.name)).toEqual(['First'])
    expect(file?.unreadable).toEqual(['Second'])
  })

  test('takes an SVG’s comments before its root in stride', () => {
    const svg = `${'<!---->'.repeat(10_000)}x`
    expect(readDrawIOBytes(new TextEncoder().encode(svg))).toBeNull()
  })
})
