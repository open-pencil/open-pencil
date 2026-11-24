// Writes `packages/kiwi/src/fig/schema/fig.kiwi` from the schema a Figma-saved `.fig` file holds:
// bun run generate:fig-schema <file.fig>
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { additions, incompatibleChanges } from '#fig-schema/compatibility'
import { inflateSync } from 'fflate'

import { parseFigBuffer } from '@open-pencil/fig'
import {
  decodeBinarySchema,
  parseSchema,
  prettyPrintSchema
} from '@open-pencil/kiwi/schema-runtime'
import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

const [source] = process.argv.slice(2)
if (!source) throw new Error('Usage: bun run generate:fig-schema <file.fig>')

const target = join(
  await resolveWorkspaceRoot(process.cwd()),
  'packages/kiwi/src/fig/schema/fig.kiwi'
)
const bytes = await readFile(source)
const { figSchemaDeflated } = parseFigBuffer(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
)
const next = decodeBinarySchema(inflateSync(figSchemaDeflated))
const current = parseSchema(await readFile(target, 'utf8'))

const broken = incompatibleChanges(current, next)
if (broken.length > 0) {
  console.error(`The file's schema would break what OpenPencil writes:\n${broken.join('\n')}`)
  process.exit(1)
}
await writeFile(target, prettyPrintSchema(next))
const added = additions(current, next)
console.log(
  `Wrote ${next.definitions.length} definitions: ${added.definitions.length} new, ${added.fields.length} new fields.`
)
