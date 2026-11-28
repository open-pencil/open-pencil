import { open, readdir, readFile, realpath, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { delimiter, extname, join, posix, win32 } from 'node:path'

import { chunk, compact, uniq } from 'es-toolkit'

import {
  fontAxes,
  fontFaceName,
  fontLegacyFaceName,
  fontManager,
  fontTableView,
  namedInstances,
  UnsupportedFontFormatError
} from '@open-pencil/core/text'
import {
  type FontFamilyStyle,
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
  /**
   * The family and style of the face's legacy names, when they name another family: Windows
   * lists a face beyond regular, bold, and italic under it, as "Segoe UI Semibold" "Regular".
   */
  legacy: FontFamilyStyle | null
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
    .map((entry) => posix.join(MACOS_FONT_ASSETS, entry))
}

/** The user's home folder, or none where the system cannot say, as in a container without one. */
function homeFolder(): string | null {
  try {
    return homedir()
  } catch {
    return null
  }
}

/** The folders a platform installs fonts in, or the ones `OPENPENCIL_FONT_DIRS` names. */
export async function systemFontDirectories(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  home: () => string | null = homeFolder
): Promise<string[]> {
  const configured = env[FONT_DIRS_ENV]
  if (configured !== undefined) return compact(configured.split(delimiter))
  // Read only when a platform folder needs it, and an empty variable counts as unset (XDG).
  const user = home()
  if (platform === 'darwin') {
    return compact([
      '/System/Library/Fonts',
      '/Library/Fonts',
      user && posix.join(user, 'Library', 'Fonts'),
      ...(await macOSFontAssetDirectories())
    ])
  }
  if (platform === 'win32') {
    return compact([
      win32.join(env.WINDIR || 'C:\\Windows', 'Fonts'),
      env.LOCALAPPDATA && win32.join(env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts')
    ])
  }
  const dataHome = env.XDG_DATA_HOME || (user && posix.join(user, '.local', 'share'))
  const dataDirs = (env.XDG_DATA_DIRS || '/usr/local/share:/usr/share').split(':')
  return uniq(
    compact([
      user && posix.join(user, '.fonts'),
      ...compact([dataHome, ...dataDirs]).map((dir) => posix.join(dir, 'fonts'))
    ])
  )
}

/**
 * The font files in a folder and its subfolders, by path. Linked folders are followed, as Linux
 * font packages often link theirs into `/usr/share/fonts`, and each folder is read once, so a
 * link back up the tree ends.
 */
async function fontFiles(directory: string, visited = new Set<string>()): Promise<string[]> {
  const real = await realpath(directory).catch(() => null)
  if (!real || visited.has(real)) return []
  visited.add(real)
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
  const files: string[] = []
  for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const path = join(directory, entry.name)
    const isDirectory =
      entry.isDirectory() ||
      (entry.isSymbolicLink() && (await stat(path).catch(() => null))?.isDirectory() === true)
    if (isDirectory) appendAll(files, await fontFiles(path, visited))
    else if (FONT_EXTENSIONS.has(extname(entry.name).toLowerCase())) files.push(path)
  }
  return files
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
  const legacy = fontLegacyFaceName(subset)
  const os2 = fontTableView(subset, 'OS/2')
  const selection = uint16At(os2, OS2_SELECTION, 0)
  const macStyle = uint16At(fontTableView(subset, 'head'), HEAD_MAC_STYLE, 0)
  return {
    family: names.family,
    style: names.style,
    legacy: legacy && legacy.family !== names.family ? legacy : null,
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
  // One record of the folders read, so a folder linked from two places is listed once.
  const visited = new Set<string>()
  const paths: string[] = []
  for (const directory of directories) appendAll(paths, await fontFiles(directory, visited))
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

function ownNames(face: InstalledFace): string[] {
  return [face.style, ...face.instances]
}

function namedFace(
  faces: InstalledFace[],
  style: string,
  names: (face: InstalledFace) => string[] = ownNames
): InstalledFace | undefined {
  const wanted = styleSpelling(style)
  const named = faces.find((face) => names(face).some((name) => styleSpelling(name) === wanted))
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

function isFamily(name: string, wanted: string): boolean {
  return name.toLowerCase() === wanted.toLowerCase()
}

/** The faces of `family`: those whose font names it, else those whose legacy names name it. */
function familyFaces(faces: readonly InstalledFace[], family: string) {
  const own = faces.filter((face) => isFamily(face.family, family))
  const legacy = faces.filter((face) => face.legacy && isFamily(face.legacy.family, family))
  return { own, legacy }
}

/**
 * The installed face for a family and style, as the desktop app picks it: a face or named
 * instance of that name, else, for a style that only names a weight and slant, the face of that
 * weight and slant, preferring normal width, or a variable face whose weight axis reaches it.
 * Weights come from the font's own `OS/2` table, so Hiragino Sans' `W3` is 300, not `Regular`.
 * A family Windows lists apart, such as "Segoe UI Semibold", finds its faces by their legacy
 * names, its style among them ("Regular").
 */
export function chooseInstalledFace(
  faces: readonly InstalledFace[],
  family: string,
  style: string
): InstalledFace | undefined {
  for (const name of uniq([family, normalizeFontFamily(family)])) {
    const { own, legacy } = familyFaces(faces, name)
    const found =
      namedFace(own, style) ??
      namedFace(legacy, style, (face) => [face.legacy?.style ?? '', ...ownNames(face)])
    if (found) return found
  }
  return undefined
}

function hasOnlyUndrawableFaces(faces: readonly InstalledFace[], family: string): boolean {
  const listed = uniq([family, normalizeFontFamily(family)]).flatMap((name) => {
    const { own, legacy } = familyFaces(faces, name)
    return [...own, ...legacy]
  })
  return listed.length > 0 && listed.every((face) => !face.drawable)
}

let installed: Promise<InstalledFace[]> | null = null

function installedFaces(): Promise<InstalledFace[]> {
  installed ??= systemFontDirectories()
    .then(listInstalledFaces)
    .catch((error: unknown) => {
      // A listing that failed is tried again on the next font asked for.
      installed = null
      throw error
    })
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
