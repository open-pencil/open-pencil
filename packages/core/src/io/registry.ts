import type { SceneGraph } from '../scene-graph'
import type { ExportRequest, IOContext, IOFormatAdapter, ReadDocumentInput } from './types'

export class IORegistry {
  constructor(private readonly adapters: IOFormatAdapter[]) {}

  listFormats(): IOFormatAdapter[] {
    return this.adapters
  }

  getFormat(id: string): IOFormatAdapter | null {
    return this.adapters.find((adapter) => adapter.id === id) ?? null
  }

  listReadableFormats(): IOFormatAdapter[] {
    return this.adapters.filter((adapter) => adapter.support.readDocument)
  }

  listWritableFormats(): IOFormatAdapter[] {
    return this.adapters.filter((adapter) => adapter.support.writeDocument)
  }

  listExportFormats(scope: ExportRequest['target']['scope']): IOFormatAdapter[] {
    return this.adapters.filter((adapter) => {
      switch (scope) {
        case 'document':
          return !!adapter.support.exportDocument
        case 'page':
          return !!adapter.support.exportPage
        case 'selection':
          return !!adapter.support.exportSelection
        case 'node':
          return !!adapter.support.exportNode
        default:
          return false
      }
    })
  }

  findReader(fileName: string, mimeType?: string): IOFormatAdapter | null {
    return (
      this.adapters.find((adapter) => {
        if (!adapter.support.readDocument) return false
        if (adapter.matchesFile) return adapter.matchesFile(fileName, mimeType)
        const lower = fileName.toLowerCase()
        return adapter.extensions.some((ext) => lower.endsWith(`.${ext}`))
      }) ?? null
    )
  }

  async readDocument(input: ReadDocumentInput, context?: IOContext) {
    const reader = this.findReader(input.name ?? '', input.mimeType)
    if (!reader?.readDocument) {
      throw new Error(`Unsupported document format: ${input.name ?? 'unknown'}`)
    }
    return reader.readDocument(input, context)
  }

  async writeDocument(formatId: string, graph: SceneGraph, options?: unknown, context?: IOContext) {
    const adapter = this.getFormat(formatId)
    if (!adapter?.writeDocument) {
      throw new Error(`Format does not support writeDocument: ${formatId}`)
    }
    return adapter.writeDocument(graph, options, context)
  }

  async exportContent(
    formatId: string,
    request: ExportRequest,
    options?: unknown,
    context?: IOContext
  ) {
    const adapter = this.getFormat(formatId)
    if (!adapter?.exportContent) {
      throw new Error(`Format does not support exportContent: ${formatId}`)
    }
    return adapter.exportContent(request, options, context)
  }
}
