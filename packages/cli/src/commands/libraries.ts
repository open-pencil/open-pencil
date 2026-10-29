import { extname, resolve } from 'node:path'

import { defineCommand } from 'citty'

import { ensureLibraryAssetKeys } from '@open-pencil/core/library'

import { bold, dim, fmtList, ok, printError } from '#cli/format'
import { loadDocument, populateWholeDocument, writeFigDocument } from '#cli/headless'
import { FileSystemLibraryCatalog } from '#cli/library/catalog'

const list = defineCommand({
  meta: { description: 'List component libraries in a filesystem catalog' },
  args: {
    root: { type: 'string', description: 'Library catalog directory', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const libraries = await new FileSystemLibraryCatalog(args.root).listLibraries()
    if (args.json) {
      console.log(JSON.stringify(libraries, null, 2))
      return
    }
    console.log('')
    console.log(bold(`  ${libraries.length} component libraries`))
    console.log('')
    console.log(
      fmtList(
        libraries.map((library) => ({
          header: `${library.name} (${library.libraryId})`,
          details: {
            revision: library.latestRevisionId,
            assets: library.assetCount,
            published: library.publishedAt
          }
        })),
        { compact: true }
      )
    )
    console.log('')
  }
})

const publish = defineCommand({
  meta: { description: 'Publish a document as a component library revision' },
  args: {
    file: { type: 'positional', description: 'Source .fig file', required: true },
    root: { type: 'string', description: 'Library catalog directory', required: true },
    id: { type: 'string', description: 'Stable library ID', required: true },
    name: { type: 'string', description: 'Library name', required: true },
    description: { type: 'string', description: 'Revision description' },
    previous: { type: 'string', description: 'Expected previous revision ID' },
    write: {
      type: 'boolean',
      alias: 'w',
      description: 'Save the asset keys given to components without one back to the source .fig'
    },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const file = resolve(args.file)
    if (args.write && extname(file).toLowerCase() !== '.fig') {
      printError('--write saves asset keys only to a .fig source')
      process.exit(1)
    }
    const graph = await loadDocument(file)
    populateWholeDocument(graph)
    // A component without an asset key takes the one its name gives; `--write` keeps it in the
    // source, so renaming the component later does not change its identity across revisions.
    const assigned = ensureLibraryAssetKeys(graph).filter((assignment) => !assignment.existing)
    const revision = await new FileSystemLibraryCatalog(args.root).publishRevision({
      libraryId: args.id,
      name: args.name,
      graph,
      description: args.description,
      previousRevisionId: args.previous || null
    })
    // Only once published: a failed publication leaves the source as it was.
    if (args.write && assigned.length > 0) await writeFigDocument(graph, file)
    if (args.json) {
      console.log(JSON.stringify(revision.manifest, null, 2))
      return
    }
    if (assigned.length > 0) {
      const one = assigned.length === 1
      console.log(
        args.write
          ? ok(`Saved ${assigned.length} new asset key${one ? '' : 's'} to ${file}`)
          : dim(
              `${assigned.length} ${one ? 'component took an asset key from its name' : 'components took asset keys from their names'}; pass --write to keep ${one ? 'it' : 'them'} in ${file}`
            )
      )
    }
    console.log(ok(`Published ${revision.manifest.name} @ ${revision.manifest.revisionId}`))
  }
})

export default defineCommand({
  meta: { description: 'Manage component library catalogs' },
  subCommands: { list, publish }
})
