import { discoverTypeShapeFiles, INTERSECTION_ROOTS, TYPE_SHAPE_ROOTS } from './files'
import { duplicateShapes } from './shapes'

const named = new Set(await discoverTypeShapeFiles(TYPE_SHAPE_ROOTS))
const files = await discoverTypeShapeFiles(INTERSECTION_ROOTS)
const duplicates = duplicateShapes(
  await Promise.all(
    files.map(async (path) => [path, await Bun.file(path).text(), named.has(path)] as const)
  )
)

for (const locations of duplicates) {
  console.error('\nDuplicate object type shape:')
  for (const location of locations) {
    console.error(`  ${location.file}:${location.line} ${location.name}`)
  }
}

if (duplicates.length > 0) {
  console.error(
    `\nFound ${duplicates.length} duplicate object type shape${duplicates.length === 1 ? '' : 's'}.`
  )
  process.exit(1)
}

console.log('No duplicate object type shapes found.')
