import { resolve } from 'node:path'

import { defineCommand } from 'citty'

import { bold, fmtList, ok } from '#cli/format'
import { loadDocument, populateWholeDocument } from '#cli/headless'
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
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const graph = await loadDocument(resolve(args.file))
    populateWholeDocument(graph)
    const revision = await new FileSystemLibraryCatalog(args.root).publishRevision({
      libraryId: args.id,
      name: args.name,
      graph,
      description: args.description,
      previousRevisionId: args.previous || null
    })
    if (args.json) {
      console.log(JSON.stringify(revision.manifest, null, 2))
      return
    }
    console.log(ok(`Published ${revision.manifest.name} @ ${revision.manifest.revisionId}`))
  }
})

export default defineCommand({
  meta: { description: 'Manage component library catalogs' },
  subCommands: { list, publish }
})
