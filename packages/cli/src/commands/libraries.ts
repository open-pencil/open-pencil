import { extname, resolve } from 'node:path'

import { defineCommand } from 'citty'

import { reapplyInstanceComponentProperties } from '@open-pencil/core'
import { flushPendingLayout, startPendingLayout } from '@open-pencil/core/figma-api'
import { ensureLibraryAssetKeys } from '@open-pencil/core/library'
import { prepareGraphFonts } from '@open-pencil/core/text'

import { bold, dim, fmtList, kv, ok, printError } from '#cli/format'
import {
  documentWriteOptions,
  loadDocument,
  measureTextHeadlessly,
  populateWholeDocument,
  writeFigDocument
} from '#cli/headless'
import { FileSystemLibraryCatalog } from '#cli/library/catalog'
import { updateLibraryFromSource } from '#cli/library/update'

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

const update = defineCommand({
  meta: {
    description:
      "Update a document's library components to the revision the library's source file makes"
  },
  args: {
    file: { type: 'positional', description: 'Document .fig file', required: true },
    source: { type: 'string', description: "The library's source .fig file", required: true },
    id: { type: 'string', description: "Library ID (default: the document's only library)" },
    'variables-by-name': {
      type: 'boolean',
      description: "Bind the library's layers to the document's variables with the same names"
    },
    ...documentWriteOptions,
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const file = resolve(args.file)
    const graph = await loadDocument(file)
    populateWholeDocument(graph)
    const source = await loadDocument(resolve(args.source))
    populateWholeDocument(source)
    await measureTextHeadlessly()
    // What the update changes is laid out again, so its text is measured in the document's fonts.
    await prepareGraphFonts(
      graph,
      graph.getPages(true).map((page) => page.id)
    )
    // As `eval` does: the edits that follow are recorded, so only their layouts are redone.
    startPendingLayout(graph)
    const result = await updateLibraryFromSource(graph, source, {
      libraryId: args.id,
      variablesByName: args['variables-by-name']
    })
    for (const instanceId of result.updatedInstances) {
      reapplyInstanceComponentProperties({ graph }, instanceId)
    }
    let output: string | null = null
    if (args.output) output = resolve(args.output)
    else if (args.write) output = file
    const written = output !== null && result.used && !result.current
    if (output && written) {
      flushPendingLayout(graph)
      await writeFigDocument(graph, output)
    }
    if (args.json) {
      console.log(JSON.stringify({ ...result, written: written ? output : null }, null, 2))
      return
    }
    if (!result.used) {
      console.log(dim(`The document does not use ${result.libraryId}; nothing to update.`))
      return
    }
    if (result.current) {
      console.log(ok(`${result.libraryId} is already at revision ${result.revisionId}`))
      return
    }
    console.log(ok(`Updated ${result.libraryId} to revision ${result.revisionId}`))
    console.log(kv('Definitions updated', String(result.updatedDefinitions.length)))
    console.log(kv('Instances swapped', String(result.updatedInstances.length)))
    console.log(kv('Definitions added', String(result.materialized)))
    console.log(kv('Definitions removed', String(result.removedDefinitions)))
    if (result.unmatchedVariables.length > 0)
      console.log(kv('Variables with no match', result.unmatchedVariables.join(', ')))
    if (!written)
      console.log(dim('Nothing written: pass --write or --output to save the document.'))
  }
})

export default defineCommand({
  meta: { description: 'Manage component libraries' },
  subCommands: { list, publish, update }
})
