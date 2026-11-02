import { fromUint8Array } from 'js-base64'

import type { FontVariation } from '@open-pencil/scene-graph'

import type { SVGFontAlias, SVGFontRequest } from '#core/io/formats/svg'
import { drawnFontVariations } from '#core/text/font/families'
import { fontInstanceVariations, staticFontInstance } from '#core/text/font/instance'
import { hasTrueTypeOutlines, isVariableFont } from '#core/text/font/variation'

/**
 * jsPDF draws text in its standard fonts and in the static TrueType files registered with it, and
 * keeps only a normal and a bold face per family. Every embedded face is therefore registered
 * under a family name of its own, and the SVG handed to svg2pdf names the face by it. A variable
 * font is embedded as a static file of each instance the text draws, cut by HarfBuzz.
 */

/** A face the text uses, with the file the canvas draws it from, or why there is none. */
export interface PDFFontFace {
  family: string
  style: string
  /** Which of the style's files, 0 for its own then its shards; 0 when left out. */
  file?: number
  data: ArrayBuffer | null
  /** Why there is no file, when `data` is null. */
  missing?: string
}

/** The jsPDF calls that register a font file. */
export interface PDFFontTarget {
  addFileToVFS(fileName: string, data: string): unknown
  addFont(fileName: string, family: string, style: string): unknown
}

export interface PDFFontReport {
  /** Faces embedded in the file, such as `Inter Bold Italic`. */
  embedded: string[]
  /** Faces drawn in a standard PDF font instead, with the reason. */
  fallback: Array<{ face: string; reason: string }>
}

interface EmbeddedFace {
  alias: string
  data: ArrayBuffer
  label: string
}

/** An instance of a variable face the text draws, before its static file is cut. */
interface PendingInstance {
  alias: string
  data: ArrayBuffer
  variations: FontVariation[]
  label: string
}

/**
 * A file the canvas draws characters from for want of glyphs in their text's own: of a fallback
 * face, or a shard of a split one, `file` 0 for the style's own then its shards.
 */
export type PDFFallbackFontFile = (
  family: string,
  style: string,
  file: number
) => ArrayBuffer | null

/**
 * The faces to embed, by family and style, and what happened to each face. Instances of variable
 * faces are named as the pages ask for them, and cut by {@link cutFontInstances}; so are fallback
 * faces, whose files `fallbackFile` gives.
 */
export interface PDFFontEmbedding {
  faces: Map<string, EmbeddedFace>
  /** Every face planned, embedded or not, so each is looked at once. */
  planned: Set<string>
  fallbackFile?: PDFFallbackFontFile
  variable: Map<string, { data: ArrayBuffer; label: string }>
  /** Each instance's alias, or null once it could not be cut. */
  instances: Map<string, string | null>
  pending: PendingInstance[]
  aliases: number
  report: PDFFontReport
}

const faceKey = (face: { family: string; style: string; file?: number }) =>
  `${face.family}\0${face.style}\0${face.file ?? 0}`

/** A face as the report names it; a shard by its place among the style's files. */
const faceLabel = (face: { family: string; style: string; file?: number }) =>
  face.file
    ? `${face.family} ${face.style} (file ${face.file + 1})`
    : `${face.family} ${face.style}`

/** Why jsPDF cannot embed a font file, or null when it can. */
function unsupportedReason(data: ArrayBuffer): string | null {
  return hasTrueTypeOutlines(data) ? null : 'not a TrueType font file'
}

// jsPDF reads family names as CSS: letters and digits only keep them unambiguous.
const aliasOf = (embedding: PDFFontEmbedding) => `EmbeddedFont${embedding.aliases++}`

/** Stops naming an instance whose file could not be embedded, so its text falls back. */
function dropInstance(embedding: PDFFontEmbedding, alias: string): void {
  for (const [key, known] of embedding.instances) {
    if (known === alias) embedding.instances.set(key, null)
  }
}

/** Plans one face: a static file to embed, a variable file to cut, or a reported fallback. */
function planFace(embedding: PDFFontEmbedding, face: PDFFontFace): void {
  const key = faceKey(face)
  embedding.planned.add(key)
  const label = faceLabel(face)
  if (!face.data) {
    embedding.report.fallback.push({
      face: label,
      reason: face.missing ?? 'font file not available'
    })
    return
  }
  const reason = unsupportedReason(face.data)
  if (reason) {
    embedding.report.fallback.push({ face: label, reason })
    return
  }
  if (isVariableFont(face.data)) {
    embedding.variable.set(key, { data: face.data, label })
    return
  }
  embedding.faces.set(key, { alias: aliasOf(embedding), data: face.data, label })
}

/** Picks the faces jsPDF can embed, each under a family name of its own. */
export function planFontEmbedding(
  faces: readonly PDFFontFace[],
  fallbackFile?: PDFFallbackFontFile
): PDFFontEmbedding {
  const embedding: PDFFontEmbedding = {
    faces: new Map(),
    planned: new Set(),
    fallbackFile,
    variable: new Map(),
    instances: new Map(),
    pending: [],
    aliases: 0,
    report: { embedded: [], fallback: [] }
  }
  for (const face of faces) planFace(embedding, face)
  return embedding
}

/** The instance of a variable face `font` is drawn at, named the first time it is asked for. */
function instanceAlias(
  embedding: PDFFontEmbedding,
  face: { data: ArrayBuffer; label: string },
  font: SVGFontRequest
): string | null {
  const variations = fontInstanceVariations(face.data, drawnFontVariations(font))
  const axes = variations.map(({ axis, value }) => `${axis} ${value}`).join(', ')
  const key = `${faceKey(font)}\0${axes}`
  const known = embedding.instances.get(key)
  if (known !== undefined) return known
  const alias = aliasOf(embedding)
  embedding.instances.set(key, alias)
  const label = axes ? `${face.label} (${axes})` : face.label
  embedding.pending.push({ alias, data: face.data, variations, label })
  return alias
}

/** The family the SVG names each embedded face by. */
export function embeddedFontAlias(embedding: PDFFontEmbedding): SVGFontAlias {
  return (font) => {
    const key = faceKey(font)
    // A fallback face or shard is planned the first time the pages draw characters in it.
    if (!embedding.planned.has(key) && embedding.fallbackFile) {
      const file = font.file ?? 0
      const data = embedding.fallbackFile(font.family, font.style, file)
      planFace(embedding, { family: font.family, style: font.style, file, data })
    }
    const variable = embedding.variable.get(key)
    if (variable) return instanceAlias(embedding, variable, font)
    return embedding.faces.get(key)?.alias ?? null
  }
}

/**
 * Cuts a static file of each variable instance the pages named, to embed with the static faces.
 * An instance HarfBuzz cannot cut is reported as a fallback; returns false when any was, so the
 * pages are written again without its name.
 */
export async function cutFontInstances(embedding: PDFFontEmbedding): Promise<boolean> {
  const pending = embedding.pending.splice(0)
  const cut = await Promise.all(
    pending.map((instance) =>
      staticFontInstance(instance.data, instance.variations).catch((error: unknown) =>
        error instanceof Error ? error : new Error(String(error))
      )
    )
  )
  let complete = true
  for (const [index, instance] of pending.entries()) {
    const data = cut[index]
    if (data instanceof ArrayBuffer) {
      embedding.faces.set(`\0${instance.alias}`, { ...instance, data })
      continue
    }
    dropInstance(embedding, instance.alias)
    embedding.report.fallback.push({
      face: instance.label,
      reason: data ? data.message : 'HarfBuzz could not cut the instance'
    })
    complete = false
  }
  return complete
}

/**
 * Registers each planned face's file with jsPDF. A face jsPDF refuses is dropped from the
 * embedding and reported as a fallback; returns false when any was.
 */
export function registerEmbeddedFonts(doc: PDFFontTarget, embedding: PDFFontEmbedding): boolean {
  let registered = true
  for (const [key, { alias, data, label }] of embedding.faces) {
    try {
      doc.addFileToVFS(`${alias}.ttf`, fromUint8Array(new Uint8Array(data)))
      doc.addFont(`${alias}.ttf`, alias, 'normal')
      embedding.report.embedded.push(label)
    } catch (error) {
      embedding.faces.delete(key)
      dropInstance(embedding, alias)
      const reason = error instanceof Error ? error.message : String(error)
      embedding.report.fallback.push({ face: label, reason })
      registered = false
    }
  }
  return registered
}
