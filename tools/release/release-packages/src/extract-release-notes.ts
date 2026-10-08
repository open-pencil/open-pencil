import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { readReleaseNotes } from './release-notes'

const [version, outputPath] = process.argv.slice(2)
if (!version || !outputPath) {
  throw new Error('Usage: bun extract-release-notes.ts <version> <output-path>')
}

const notes = await readReleaseNotes(resolve('CHANGELOG.md'), version)
await writeFile(resolve(outputPath), notes)
