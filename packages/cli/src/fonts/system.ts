import { open, readdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { delimiter, extname, join } from 'node:path'

import { chunk, compact, uniq } from 'es-toolkit'

import {
  fontAxes,
  fontFaceName,
  fontManager,
  fontTableView,
  namedInstances,
  UnsupportedFontFormatError
} from '@open-pencil/core/text'
import {
  namesWeight,
  namesWidth,
  normalizeFontFamily,
  parseFontStyle,
  styleSpelling
} from '@open-pencil/scene-graph/font-style'
import { appendAll } from '@open-pencil/std/arrays'

import {
  hasDrawableOutlines,
  readSfntFaces,
  readTableSubset,
  standaloneFace,
  type SfntFace
} from './sfnt'

/** Replaces the platform's font folders with these, separated as `PATH` is; empty for none. */
export const FONT_DIRS_ENV = 'OPENPENCIL_FONT_DIRS'

const FONT_EXTENSIONS = new Set(['.ttf', '.otf', '.ttc', '.otc'])
/** The tables a face's names, weight, slant, width, and variation axes are read from. */
const DESCRIPTION_TABLES = ['name', 'OS/2', 'head', 'fvar']
/** Font files read at once while listing, below any system's open-file limit. */
const SCAN_BATCH = 32
/** macOS keeps the fonts it downloads on demand, such as YuGothic, in these asset folders. */
const MACOS_FONT_ASSETS = '/System/Library/AssetsV2'
const MACOS_FONT_ASSET_PREFIX = 'com_apple_MobileAsset_Font'
const OS2_WEIGHT = 4
const OS2_WIDTH = 6
const OS2_SELECTION = 62
const NORMAL_WIDTH = 5
const SELECTION_ITALIC = 1
const SELECTION_OBLIQUE = 1 << 9
const HEAD_MAC_STYLE = 44
const MAC_STYLE_ITALIC = 1 << 1

/** A face an installed font file draws, by the names and traits the file gives it. */
export interface InstalledFace {
  family: string
  style: string
  /** A variable font's named instances, each a face of its own. */
  instances: string[]
  weight: number
  italic: boolean
  normalWidth: boolean
  /** The range of a variable font's `wght` axis. */
  weightAxis: [number, number] | null
  /** Whether a renderer can draw its outlines. */
  drawable: boolean
  path: string
  face: SfntFace
}

async function macOSFontAssetDirectories(): Promise<string[]> {
  const entries = await readdir(MACOS_FONT_ASSETS).catch(() => [])
  return entries
    .filter((entry) => entry.startsWith(MACOS_FONT_ASSET_PREFIX))
    .map((entry) => join(MACOS_FONT_ASSETS, entry))
}

/** The folders a platform installs fonts in, or the ones `OPENPENCIL_FONT_DIRS` names. */
export async function systemFontDirectories(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  home = homedir()
): Promise<string[]> {
  const configured = env[FONT_DIRS_ENV]
  if (configured !== undefined) return compact(configured.split(delimiter))
  if (platform === 'darwin') {
    return [
      '/System/Library/Fonts',
      '/Library/Fonts',
      join(home, 'Library', 'Fonts'),
      ...(await macOSFontAssetDirectories())
    ]
  }
  if (platform === 'win32') {
    return compact([
      join(env.WINDIR ?? 'C:\\Windows', 'Fonts'),
      env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts')
    ])
  }
  const dataHome = env.XDG_DATA_HOME ?? join(home, '.local', 'share')
  const dataDirs = (env.XDG_DATA_DIRS ?? '/usr/local/share:/usr/share').split(':')
  return uniq([
    join(home, '.fonts'),
    ...[dataHome, ...compact(dataDirs)].map((dir) => join(dir, 'fonts'))
  ])
}

async function fontFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { recursive: true }).catch(() => [])
  return entries
    .filter((entry) => FONT_EXTENSIONS.has(extname(entry).toLowerCase()))
    .map((entry) => join(directory, entry))
    .sort()
}

function weightAxisOf(subset: ArrayBuffer): [number, number] | null {
  const axis = fontAxes(subset)?.find((candidate) => candidate.tag === 'wght')
  return axis ? [axis.min, axis.max] : null
}

/** A 16-bit field of a table, or `fallback` when the table is missing or too short for it. */
function uint16At(table: DataView | null, offset: number, fallback: number): number {
  return table && table.byteLength >= offset + 2 ? table.getUint16(offset) : fallback
}

function describeFace(path: string, face: SfntFace, subset: ArrayBuffer): InstalledFace | null {
  const names = fontFaceName(subset)
  if (!names) return null
  const os2 = fontTableView(subset, 'OS/2')
  const selection = uint16At(os2, OS2_SELECTION, 0)
  const macStyle = uint16At(fontTableView(subset, 'head'), HEAD_MAC_STYLE, 0)
  return {
    family: names.family,
    style: names.style,
    instances: namedInstances(subset).map((instance) => instance.name),
    weight: uint16At(os2, OS2_WEIGHT, 400),
    italic:
      (selection & (SELECTION_ITALIC | SELECTION_OBLIQUE)) !== 0 ||
      (macStyle & MAC_STYLE_ITALIC) !== 0,
    normalWidth:
      uint16At(os2, OS2_WIDTH, NORMAL_WIDTH) === NORMAL_WIDTH && !namesWidth(names.style),
    weightAxis: weightAxisOf(subset),
    drawable: hasDrawableOutlines(face),
    path,
    face
  }
}

/** The faces a font file draws; none when it cannot be read as a font. */
export async function readInstalledFaces(path: string): Promise<InstalledFace[]> {
  const file = await open(path).catch(() => null)
  if (!file) return []
  try {
    const described: InstalledFace[] = []
    for (const face of await readSfntFaces(file)) {
      const subset = await readTableSubset(file, face, DESCRIPTION_TABLES)
      const installed = subset && describeFace(path, face, subset)
      if (installed) described.push(installed)
    }
    return described
  } catch {
    // A file that names itself a font but is cut short or malformed draws nothing.
    return []
  } finally {
    await file.close()
  }
}

/** Every face the font files in `directories` draw, in folder order and then by path. */
export async function listInstalledFaces(directories: readonly string[]): Promise<InstalledFace[]> {
  const paths = (await Promise.all(directories.map(fontFiles))).flat()
  const faces: InstalledFace[] = []
  for (const batch of chunk(paths, SCAN_BATCH)) {
    appendAll(faces, (await Promise.all(batch.map(readInstalledFaces))).flat())
  }
  return faces
}

/** The standard weight nearest to `weight`; a tie goes to the lighter one. */
function namedWeight(weight: number): number {
  return Math.min(900, Math.max(100, Math.ceil(weight / 100 - 0.5) * 100))
}

function chooseFace(faces: InstalledFace[], weight: number, italic: boolean) {
  const sameSlant = faces.filter((face) => face.italic === italic)
  return (
    sameSlant.find((face) => namedWeight(face.weight) === weight) ??
    sameSlant.find(
      (face) => face.weightAxis && face.weightAxis[0] <= weight && weight <= face.weightAxis[1]
    )
  )
}

function namedFace(faces: InstalledFace[], style: string): InstalledFace | undefined {
  const wanted = styleSpelling(style)
  const named = faces.find((face) =>
    [face.style, ...face.instances].some((name) => styleSpelling(name) === wanted)
  )
  // A face named apart from its weight ("Book", "Condensed Bold") is that face or none.
  if (named || !namesWeight(style)) return named
  const { weight, italic } = parseFontStyle(style)
  return (
    chooseFace(
      faces.filter((face) => face.normalWidth),
      weight,
      italic
    ) ?? chooseFace(faces, weight, italic)
  )
}

/**
 * The installed face for a family and style, as the desktop app picks it: a face or named
 * instance of that name, else, for a style that only names a weight and slant, the face of that
 * weight and slant, preferring normal width, or a variable face whose weight axis reaches it.
 * Weights come from the font's own `OS/2` table, so Hiragino Sans' `W3` is 300, not `Regular`.
 */
export function chooseInstalledFace(
  faces: readonly InstalledFace[],
  family: string,
  style: string
): InstalledFace | undefined {
  for (const name of uniq([family, normalizeFontFamily(family)])) {
    const wanted = name.toLowerCase()
    const listed = faces.filter((face) => face.family.toLowerCase() === wanted)
    const found = namedFace(listed, style)
    if (found) return found
  }
  return undefined
}

function hasOnlyUndrawableFaces(faces: readonly InstalledFace[], family: string): boolean {
  const wanted = family.toLowerCase()
  const listed = faces.filter((face) => face.family.toLowerCase() === wanted)
  return listed.length > 0 && listed.every((face) => !face.drawable)
}

let installed: Promise<InstalledFace[]> | null = null

function installedFaces(): Promise<InstalledFace[]> {
  installed ??= systemFontDirectories().then(listInstalledFaces)
  return installed
}

/** The data of the installed face for a family and style, standing alone if it is in a collection. */
export async function loadInstalledFont(
  faces: readonly InstalledFace[],
  family: string,
  style: string
): Promise<ArrayBuffer | null> {
  const face = chooseInstalledFace(
    faces.filter((candidate) => candidate.drawable),
    family,
    style
  )
  if (!face) {
    if (hasOnlyUndrawableFaces(faces, family)) throw new UnsupportedFontFormatError(family, style)
    return null
  }
  // A font removed or locked since the folders were listed loads nothing, as a missing one does.
  const data = await readFile(face.path).catch(() => null)
  return data ? (standaloneFace(new Uint8Array(data), face.face)?.buffer ?? null) : null
}

let systemFontsInstalled = false

/**
 * Lets the font manager draw the fonts installed on this machine, as the desktop app does: a
 * document set in a system font, such as Hiragino Sans on macOS, otherwise draws in a stand-in.
 * The folders are listed on the first font asked for, once per process.
 */
export function installSystemFonts(): void {
  if (systemFontsInstalled) return
  systemFontsInstalled = true
  fontManager.setHostFontLoader(async (family, style) =>
    loadInstalledFont(await installedFaces(), family, style)
  )
}
