import { groupBy } from 'es-toolkit'
import { dirname, join } from 'pathe'
import { decodePath } from 'ufo'

import {
  buildPenGraph,
  importedDocument,
  isDataURL,
  parsePenDocument,
  penAssets,
  rebaseImages,
  withImports,
  type PenDocument,
  type PenIconRequest,
  type PenIconSource,
  type PenImports
} from '@open-pencil/pen'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { defaultIcons, drawIcon, type IconData, type IconProvider } from '#core/icons'
import type { IOContext, ReadDocumentInput } from '#core/io/types'
import { layoutAuthoredNodes } from '#core/layout'
import { prepareGraphFonts } from '#core/text/prepare'

import { loadPenFonts } from './fonts'

/** The size icons are fetched at; each is scaled to the box it is drawn in. */
const PEN_ICON_SIZE = 24

/** How the host reads a file a document names, by its path from the document being read. */
type ReadFile = ReadDocumentInput['readAsset']

/**
 * A file's bytes, such as an image's or a font's: a data URL decoded by the platform's own URL handling, a file through the
 * host; null when either fails.
 */
async function loadPenFile(url: string, read: ReadFile): Promise<Uint8Array | null> {
  try {
    // pen.dev writes the path percent-encoded, as `My%20Design-assets/…`; the host keeps the
    // read inside the folder it allows.
    if (!isDataURL(url)) return (await read?.(decodePath(url))) ?? null
    // Through `URL`, which lowercases the scheme for runtimes that only fetch `data:`.
    return new Uint8Array(await (await fetch(new URL(url))).arrayBuffer())
  } catch {
    return null
  }
}

async function loadPenImages(
  urls: readonly string[],
  read: ReadFile,
  images = new Map<string, Uint8Array>()
): Promise<Map<string, Uint8Array>> {
  await Promise.all(
    urls.map(async (url) => {
      const bytes = await loadPenFile(url, read)
      if (bytes) images.set(url, bytes)
    })
  )
  return images
}

/** A request's options as a key, so requests drawn the same way share a fetch. */
const optionsKey = (options: Record<string, number> | undefined) => JSON.stringify(options ?? null)

/**
 * Icons from `provider`, fetched once for each way they are drawn; a document whose icons cannot
 * be fetched opens with empty icons.
 */
async function loadPenIcons(
  requests: readonly PenIconRequest[],
  provider: IconProvider
): Promise<PenIconSource> {
  const glyphs = new Map<string, IconData>()
  const byOptions = groupBy(requests, (request) => optionsKey(request.options))
  await Promise.all(
    Object.values(byOptions).map(async (group) => {
      const names = group.map((request) => request.name)
      const found = await provider
        .icons(names, PEN_ICON_SIZE, group[0]?.options)
        .catch(() => new Map<string, IconData>())
      for (const [name, icon] of found)
        glyphs.set(`${name}\0${optionsKey(group[0]?.options)}`, icon)
    })
  )
  return {
    draw(graph, frameId, name, size, color, options) {
      const icon = glyphs.get(`${name}\0${optionsKey(options)}`)
      if (!icon) return false
      drawIcon(graph, frameId, icon, size, color)
      return true
    }
  }
}

/** The documents a document imports, and the image files they name, by path from the document. */
interface LoadedImports {
  imports: PenImports
  images: string[]
}

/** A document the host read, or null for one it could not read or that is no `.pen` document. */
async function readImportedDocument(
  path: string,
  input: ReadDocumentInput
): Promise<PenDocument | null> {
  const bytes = await input.readImport?.(path).catch(() => null)
  if (!bytes) return null
  try {
    return parsePenDocument(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

/**
 * The documents `doc` imports, read through the host and named as `doc` names them, with the
 * documents they import in turn. `at` is `doc`'s path relative to the document being read; an
 * import the host cannot read or parse, or one that imports itself through others, is left out.
 * Their image files are renamed to their paths from the document being read, so each one is read
 * beside the document naming it.
 */
async function loadPenImports(
  doc: PenDocument,
  at: string,
  input: ReadDocumentInput,
  reading: ReadonlySet<string> = new Set([at])
): Promise<LoadedImports> {
  const entries = await Promise.all(
    Object.entries(doc.imports ?? {}).map(async ([alias, path]) => {
      const target = join(dirname(at), path)
      if (reading.has(target)) return null
      const read = await readImportedDocument(target, input)
      if (!read) return null
      const rebase = (url: string) => (isDataURL(url) ? url : join(dirname(target), url))
      const imported = rebaseImages(read, rebase)
      const nested = await loadPenImports(imported, target, input, new Set([...reading, target]))
      // Listed before they are renamed: a path out of the document's folder is no asset of its own.
      const images = [...penAssets(read).images.map(rebase), ...nested.images]
      return { alias, doc: importedDocument(alias, imported, nested.imports), images }
    })
  )
  const loaded = entries.filter((entry) => entry !== null)
  return {
    imports: new Map(loaded.map((entry) => [entry.alias, entry.doc])),
    images: loaded.flatMap((entry) => entry.images)
  }
}

/**
 * A `.pen` document as a scene graph, with the documents it imports, the images, fonts, and icons
 * they name read through the host, and the layout its sizes and positions follow from.
 */
export async function readPenDocument(
  input: ReadDocumentInput,
  context?: IOContext
): Promise<SceneGraph> {
  const doc = parsePenDocument(new TextDecoder().decode(input.data))
  const { imports, images: importedImages } = await loadPenImports(doc, '', input)
  const ownImages = penAssets(doc).images
  // Icons the imported components draw too, and their images, which may lie outside the
  // document's folder and so are read as imports are.
  const images = new Map<string, Uint8Array>()
  const [icons, fonts] = await Promise.all([
    loadPenIcons(penAssets(withImports(doc, imports)).icons, context?.icons ?? defaultIcons),
    loadPenFonts(doc.fonts ?? [], (url) => loadPenFile(url, input.readAsset)),
    loadPenImages(ownImages, input.readAsset, images),
    loadPenImages(importedImages, input.readImport, images)
  ])
  // Its text takes fonts from variables and components too, so the fonts it uses are read
  // from a build without layout and prepared before the build that lays it out.
  const unlaid = buildPenGraph(doc, { images, icons, fonts, imports })
  await prepareGraphFonts(
    unlaid,
    unlaid.getPages(true).map((page) => page.id)
  )
  // A .pen file stores its layout intent, not the sizes and positions it implies.
  return buildPenGraph(doc, {
    images,
    icons,
    fonts,
    imports,
    // The internal page too, which holds the imported components the document uses.
    layout: (target) =>
      layoutAuthoredNodes(
        target,
        target.getPages(true).map((page) => page.id)
      )
  })
}
