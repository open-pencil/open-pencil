import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import { buildDemoDocument } from './build'

/** Bun entry that `ensureDemoDocument` runs: build the demo and write it to the given path. */
const [output] = process.argv.slice(2)
if (!output) throw new Error('Usage: bun write.ts <output.fig>')
const bytes = await buildDemoDocument()
await mkdir(dirname(output), { recursive: true })
await writeFile(`${output}.tmp`, bytes)
await rename(`${output}.tmp`, output)
