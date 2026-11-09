// Fetches the CanvasKit build `release.json` pins, a release of open-pencil/skia, into dist/ and
// checks each file against its SHA-256. Files already there with the pinned hash are kept, so
// it downloads only on a fresh checkout or when the pin changes.
//   bun scripts/fetch.ts
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import * as v from 'valibot'

const PACKAGE = join(import.meta.dir, '..')
const DIST = join(PACKAGE, 'dist')
const RELEASES = 'https://github.com/open-pencil/skia/releases/download'

const releaseSchema = v.object({
  /** The open-pencil/skia commit the release was built from. */
  skia: v.pipe(v.string(), v.regex(/^[0-9a-f]{40}$/)),
  /** Each file of the release with its SHA-256. */
  files: v.record(v.string(), v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)))
})

const sha256 = (bytes: Uint8Array) => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')

async function hasFile(name: string, hash: string): Promise<boolean> {
  const file = Bun.file(join(DIST, name))
  return (await file.exists()) && sha256(await file.bytes()) === hash
}

async function download(url: string, name: string, hash: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`)
  const bytes = await response.bytes()
  const actual = sha256(bytes)
  if (actual !== hash) throw new Error(`${name} has SHA-256 ${actual}, release.json pins ${hash}`)
  await writeFile(join(DIST, name), bytes)
}

const parsed = v.safeParse(
  v.pipe(v.string(), v.parseJson(), releaseSchema),
  await readFile(join(PACKAGE, 'release.json'), 'utf8')
)
if (!parsed.success) throw new Error(`release.json: ${v.summarize(parsed.issues)}`)
const { skia, files } = parsed.output

const missing: Array<[string, string]> = []
for (const [name, hash] of Object.entries(files)) {
  if (!(await hasFile(name, hash))) missing.push([name, hash])
}
if (missing.length === 0) {
  process.stdout.write(`CanvasKit ${skia.slice(0, 10)} is up to date\n`)
} else {
  await mkdir(DIST, { recursive: true })
  await Promise.all(
    missing.map(([name, hash]) => download(`${RELEASES}/canvaskit-${skia}/${name}`, name, hash))
  )
  process.stdout.write(
    `Fetched CanvasKit ${skia.slice(0, 10)}: ${missing.map(([n]) => n).join(', ')}\n`
  )
}
