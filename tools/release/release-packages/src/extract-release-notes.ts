import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import * as v from 'valibot'

import { readReleaseNotes } from './release-notes'

const [version, outputPath] = process.argv.slice(2)
if (!version || !outputPath) {
  throw new Error('Usage: bun extract-release-notes.ts <version> <output-path>')
}

// Actions names the repository; the notes link to its changelog when they are shortened.
const repository = v.parse(
  v.pipe(v.string(), v.regex(/^[\w.-]+\/[\w.-]+$/)),
  process.env.GITHUB_REPOSITORY
)
const notes = await readReleaseNotes(resolve('CHANGELOG.md'), version, repository)
await writeFile(resolve(outputPath), notes)
