import { mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

import { defineCommand } from 'citty'

import { createFigReview } from '@open-pencil/fig'

async function writeReview(input: string, output: string, review: string): Promise<void> {
  const source = await stat(input)
  const target = await stat(output).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return undefined
    throw error
  })
  if (
    resolve(input) === resolve(output) ||
    (target?.dev === source.dev && target.ino === source.ino)
  ) {
    throw new Error('Review output must not identify the input FIG file')
  }
  const staging = await mkdtemp(join(dirname(output), '.openpencil-review-'))
  try {
    const temporary = join(staging, 'review.json')
    await writeFile(temporary, review)
    await rename(temporary, output)
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}

export default defineCommand({
  meta: { description: 'Write a deterministic review snapshot of every saved FIG record' },
  args: {
    file: { type: 'positional', description: 'FIG document path', required: true },
    output: { type: 'string', alias: 'o', description: 'Write JSON to this path instead of stdout' }
  },
  async run({ args }) {
    const bytes = await readFile(args.file)
    const review = createFigReview(Uint8Array.from(bytes).buffer)
    if (args.output) await writeReview(args.file, args.output, review)
    else process.stdout.write(review)
  }
})
