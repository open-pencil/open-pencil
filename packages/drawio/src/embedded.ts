import { boundedInflate, percentDecoded, type InflateBudget } from './inflate'
import { parseXML } from './xml'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
/** The keyword draw.io stores its diagram under in a PNG's text chunks. */
const DRAWIO_KEYWORD = 'mxfile'

const latin1 = new TextDecoder('latin1')
const utf8 = new TextDecoder()

function isPNG(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)
}

/** Where a NUL byte ends the field that starts at `from`, or -1. */
function fieldEnd(data: Uint8Array, from: number): number {
  return data.indexOf(0, from)
}

/**
 * The diagram a text chunk holds when its keyword is draw.io's: `tEXt` as Latin-1, `zTXt`
 * zlib-compressed, `iTXt` as UTF-8, compressed or not. draw.io percent-encodes the XML in all three.
 */
function chunkDiagram(type: string, data: Uint8Array, budget: InflateBudget): string | null {
  const keywordEnd = fieldEnd(data, 0)
  if (keywordEnd === -1 || latin1.decode(data.subarray(0, keywordEnd)) !== DRAWIO_KEYWORD)
    return null
  if (type === 'tEXt') return percentDecoded(latin1.decode(data.subarray(keywordEnd + 1)))
  if (type === 'zTXt') {
    // The compression method byte, then a zlib stream: a 2-byte header before raw deflate.
    const inflated = boundedInflate(data.subarray(keywordEnd + 4), budget)
    return percentDecoded(latin1.decode(inflated))
  }
  // iTXt: compressed flag and method, then language and translated keyword, each NUL-ended.
  const compressed = data[keywordEnd + 1] === 1
  const languageEnd = fieldEnd(data, keywordEnd + 3)
  const translatedEnd = languageEnd === -1 ? -1 : fieldEnd(data, languageEnd + 1)
  if (translatedEnd === -1) return null
  const text = data.subarray(translatedEnd + 1)
  return percentDecoded(utf8.decode(compressed ? boundedInflate(text.subarray(2), budget) : text))
}

/**
 * The draw.io diagram a PNG export carries, or null when it carries none. A compressed chunk that
 * is damaged or too large to unpack is an error that says so.
 */
function diagramInPNG(bytes: Uint8Array, budget: InflateBudget): string | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = PNG_SIGNATURE.length
  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset)
    const type = latin1.decode(bytes.subarray(offset + 4, offset + 8))
    const start = offset + 8
    if (start + length > bytes.length || type === 'IEND') return null
    if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
      let diagram: string | null
      try {
        diagram = chunkDiagram(type, bytes.subarray(start, start + length), budget)
      } catch (error) {
        throw new Error('Could not read the draw.io diagram in this image', { cause: error })
      }
      if (diagram) return diagram
    }
    // The chunk's data, then its 4-byte CRC.
    offset = start + length + 4
  }
  return null
}

/** The draw.io diagram an SVG export carries in its root's `content` attribute, or null. */
function diagramInSVG(text: string): string | null {
  const root = parseXML(text)
  if (root?.localName !== 'svg') return null
  const content = root.getAttribute('content')
  return content?.includes('<mxfile') || content?.includes('<mxGraphModel') ? content : null
}

/**
 * The draw.io XML a file holds: the file itself for `.drawio` and `.dio`, or the diagram a PNG or
 * SVG export embeds. Null when a PNG or SVG embeds none.
 */
export function drawioSource(bytes: Uint8Array, budget: InflateBudget): string | null {
  if (isPNG(bytes)) return diagramInPNG(bytes, budget)
  const text = utf8.decode(bytes)
  if (
    /^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(text)
  ) {
    return diagramInSVG(text)
  }
  return text
}

/** Whether a file name is draw.io's for an editable export, such as `flow.drawio.png`. */
export function isDrawioExportFileName(fileName: string): boolean {
  return /\.drawio\.(?:png|svg)$/i.test(fileName)
}
