import { defineCommand } from 'citty'

import { fontManager, prepareGraphFonts, type DocumentFontStatus } from '@open-pencil/core/text'

import { appTargetOptions } from '#cli/app-target'
import { bold, entity, fmtList, kv, printError } from '#cli/format'
import { loadDocument } from '#cli/headless'
import { loadRPCData } from '#cli/rpc-data'

function statusLabel(status: DocumentFontStatus['faces'][number]['status']): string {
  return status
}

async function prepareFontStatus(
  graph: Awaited<ReturnType<typeof loadDocument>>,
  roots: string[]
): Promise<DocumentFontStatus> {
  const previousProviders = fontManager.enabledOnlineFontProviders()
  fontManager.setOnlineFontProviders({})
  fontManager.setWebFontFetch(null)
  try {
    return await prepareGraphFonts(graph, roots)
  } finally {
    fontManager.setOnlineFontProviders(
      Object.fromEntries(previousProviders.map((provider) => [provider, true]))
    )
  }
}

export default defineCommand({
  meta: { description: 'Report fonts used by a document' },
  args: {
    file: {
      type: 'positional',
      description: 'Document file path (omit to connect to running app)',
      required: false
    },
    ...appTargetOptions,
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    let data: DocumentFontStatus
    try {
      if (!args.file) {
        data = await loadRPCData<DocumentFontStatus>(args.file, 'font-status', undefined, args)
      } else {
        const graph = await loadDocument(args.file)
        const pageIds = graph.getPages().map((page) => page.id)
        data = await prepareFontStatus(graph, pageIds.length > 0 ? pageIds : [graph.rootId])
      }
    } catch (error) {
      printError(error)
      process.exit(1)
    }

    if (args.json) {
      console.log(JSON.stringify(data, null, 2))
      return
    }
    if (data.faces.length === 0) {
      console.log('No fonts found.')
      return
    }
    console.log('')
    console.log(bold(`  ${data.faces.length} font face${data.faces.length !== 1 ? 's' : ''}`))
    console.log('')
    console.log(
      fmtList(
        data.faces.map((face) => {
          const details: Record<string, string | number> = {
            status: statusLabel(face.status)
          }
          if (face.source) details.source = face.source
          if (face.substituteFamily) details.substitute = face.substituteFamily
          if (face.nodeIds.length > 0) details.nodes = face.nodeIds.length
          return {
            header: entity(face.family, face.style),
            details
          }
        }),
        { compact: true }
      )
    )
    console.log('')
    console.log(kv('Faithful', data.faithful ? 'yes' : 'no'))
    console.log('')
  }
})
