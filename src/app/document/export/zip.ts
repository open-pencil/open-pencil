import { zipSync, type Zippable } from 'fflate'
import { extname } from 'pathe'

// Layer/page names flow into zip entry keys; flatten them to a single safe
// segment so separators, parent refs (`..`), or control chars can't escape the
// archive or corrupt it.
function sanitizeZipEntryName(name: string): string {
  const withoutControl = Array.from(name)
    .filter((ch) => {
      const code = ch.charCodeAt(0)
      return code >= 0x20 && code !== 0x7f
    })
    .join('')
  const flat = withoutControl
    .replace(/[/\\]+/g, '_') // path separators
    .replace(/\.{2,}/g, '_') // parent-dir refs / repeated dots
    .replace(/^[.\s]+/, '') // leading dots / whitespace
    .trim()
  return flat.length > 0 ? flat : 'export'
}

/**
 * Names zip entries as `bundleExportFiles` does: each a safe single segment, with ` (2)`, ` (3)`,
 * and on added to names already taken, such as two layers both producing "Frame@1x.png".
 */
export function createZipEntryNamer(): (fileName: string) => string {
  const used = new Set<string>()
  return (fileName) => {
    let name = sanitizeZipEntryName(fileName)
    if (used.has(name)) {
      const tail = extname(name)
      const stem = name.slice(0, name.length - tail.length)
      let i = 2
      while (used.has(`${stem} (${i})${tail}`)) i++
      name = `${stem} (${i})${tail}`
    }
    used.add(name)
    return name
  }
}

/** Bundles several exported files into a single zip, named by `createZipEntryNamer`. */
export function bundleExportFiles(
  files: ReadonlyArray<{ bytes: Uint8Array; fileName: string }>
): Uint8Array {
  const entries: Zippable = {}
  const name = createZipEntryNamer()
  for (const file of files) entries[name(file.fileName)] = file.bytes
  return zipSync(entries)
}
