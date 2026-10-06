import * as v from 'valibot'

import type { OkHCLPayload } from '../color/okhcl'
import { isExportFormatId, type ExportFormatId } from '../export-format'
import { clampExportScale } from '../export-scale'
import type { Rect } from '../primitives'
import {
  MODE_ATTRIBUTE_PATTERN,
  TOKEN_UNITS,
  type EnabledLibraryBinding,
  type ExportSetting,
  type LayoutDirection,
  type LibraryAssetSource,
  type SourceLibraryPublication,
  type TextDirection,
  type TokenUnit
} from '../types'
import { jsonPluginDataField, textPluginDataField, type PluginDataKey } from './field'

const DIRECTIONS = ['AUTO', 'LTR', 'RTL'] as const satisfies readonly (
  | TextDirection
  | LayoutDirection
)[]

const textPathBox: v.GenericSchema<unknown, Rect> = v.pipe(
  v.object({ x: v.number(), y: v.number(), width: v.number(), height: v.number() }),
  v.check(
    ({ x, y, width, height }) => Number.isFinite(x + y + width + height) && width > 0 && height > 0
  )
)

/** String-valued entries of a JSON object; other entries are dropped, not rejected. */
const boundVariables = v.pipe(
  v.custom<Record<string, unknown>>(
    (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
  ),
  v.transform((value) =>
    Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
      )
    )
  )
)

/** Every entry must be valid, or the whole value is ignored in favour of native settings. */
const exportSettings: v.GenericSchema<unknown, ExportSetting[]> = v.array(
  v.pipe(
    v.object({
      scale: v.pipe(v.number(), v.finite()),
      format: v.custom<ExportFormatId>(isExportFormatId)
    }),
    // Clamp at the file boundary: imported plugin data may carry a scale the UI never produces.
    v.transform(({ scale, format }) => ({ scale: clampExportScale(scale), format }))
  )
)

const librarySource: v.GenericSchema<unknown, LibraryAssetSource> = v.pipe(
  v.object({
    identity: v.object({ libraryId: v.string(), assetKey: v.string(), revisionId: v.string() }),
    sourceNodeId: v.optional(v.unknown()),
    readOnly: v.optional(v.unknown())
  }),
  v.transform(({ identity, sourceNodeId, readOnly }) => ({
    identity,
    sourceNodeId: typeof sourceNodeId === 'string' ? sourceNodeId : null,
    readOnly: readOnly === true
  }))
)

const enabledLibrary = v.object({
  libraryId: v.string(),
  revisionId: v.string(),
  enabled: v.optional(v.unknown())
})

/** Invalid entries are skipped one by one, so one bad binding keeps the others. */
const enabledLibraries: v.GenericSchema<unknown, EnabledLibraryBinding[]> = v.pipe(
  v.array(v.unknown()),
  v.transform((items) =>
    items.flatMap((item) => {
      const parsed = v.safeParse(enabledLibrary, item)
      if (!parsed.success) return []
      const { libraryId, revisionId, enabled } = parsed.output
      return [{ libraryId, revisionId, enabled: enabled === true }]
    })
  )
)

// Shape only. Whether a string is valid CSS is checked where it is written into a stylesheet.
const cssText = v.pipe(v.string(), v.trim(), v.nonEmpty(), v.maxLength(1000))

/** Token fields Figma has no slot for, with mode ids as the file spells them. */
export interface StoredToken {
  unit?: TokenUnit
  expressions?: Record<string, { css: string; resolved: number }>
}

const token: v.GenericSchema<unknown, StoredToken> = v.object({
  unit: v.optional(v.picklist(TOKEN_UNITS)),
  expressions: v.optional(
    v.record(v.string(), v.object({ css: cssText, resolved: v.pipe(v.number(), v.finite()) }))
  )
})

const okhcl: v.GenericSchema<unknown, OkHCLPayload> = v.object({
  version: v.literal(1),
  kind: v.picklist(['fill', 'stroke']),
  index: v.number(),
  color: v.object({
    h: v.number(),
    c: v.number(),
    l: v.number(),
    a: v.fallback(v.optional(v.number()), undefined)
  })
})

const sourceLibraryPublication: v.GenericSchema<unknown, SourceLibraryPublication> = v.object({
  libraryId: v.string(),
  revisionId: v.string(),
  name: v.string(),
  catalogSource: v.optional(v.string())
})

/**
 * Every plugin-data entry OpenPencil writes under {@link OPEN_PENCIL_PLUGIN_ID}: state Figma's
 * format has no field for. Add a key here, never as a string elsewhere, so reading and writing
 * it share one schema.
 */
export const OPEN_PENCIL_PLUGIN_DATA = {
  /** A text node's direction, on TEXT nodes. */
  textDirection: textPluginDataField('textDirection', DIRECTIONS),
  /** An auto-layout frame's direction. */
  layoutDirection: textPluginDataField('layoutDirection', DIRECTIONS),
  /** Marks a component set Figma would read as a plain frame. */
  nodeType: textPluginDataField('nodeType', ['COMPONENT_SET']),
  /** Variable bindings by field path, including those Figma cannot store natively. */
  boundVariables: jsonPluginDataField('boundVariables', boundVariables),
  exportSettings: jsonPluginDataField('exportSettings', exportSettings),
  /** The node-local rect a TEXT_PATH layout maps onto, which Kiwi has no field for. */
  textPathBox: jsonPluginDataField('textPathBox', textPathBox),
  /** The library asset a node was inserted from. */
  librarySource: jsonPluginDataField('librarySource', librarySource),
  /** Libraries enabled for the document, on the DOCUMENT node. */
  enabledLibraries: jsonPluginDataField('enabledLibraries', enabledLibraries),
  /** The library this document publishes as, on the DOCUMENT node. */
  sourceLibraryPublication: jsonPluginDataField(
    'sourceLibraryPublication',
    sourceLibraryPublication
  ),
  /** Unit and CSS expressions, on each VARIABLE. */
  token: jsonPluginDataField('token', token),
  /** Mode conditions by mode id, on each VARIABLE_SET. */
  modeConditions: jsonPluginDataField('modeConditions', v.record(v.string(), cssText)),
  /** The attribute that switches manual modes, on each VARIABLE_SET. */
  modeAttribute: jsonPluginDataField(
    'modeAttribute',
    v.pipe(v.string(), v.trim(), v.maxLength(100), v.regex(MODE_ATTRIBUTE_PATTERN))
  ),
  /** One entry per paint picked in OkHCL, so the picker reopens on the same coordinates. */
  okhcl: jsonPluginDataField('okhcl', okhcl)
} satisfies Record<string, PluginDataKey>
