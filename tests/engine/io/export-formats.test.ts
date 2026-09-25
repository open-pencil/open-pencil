import { describe, expect, test } from 'bun:test'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { EXPORT_FORMAT_IDS, isExportFormatId } from '@open-pencil/scene-graph'

const io = new IORegistry(BUILTIN_IO_FORMATS)

describe('export setting formats', () => {
  test('every persisted export format is a node-exportable IO adapter', () => {
    const nodeExportIds = new Set(io.listExportFormats('node').map((format) => format.id))
    for (const id of EXPORT_FORMAT_IDS) expect(nodeExportIds.has(id)).toBe(true)
  })

  test('recognizes only persisted export formats', () => {
    expect(isExportFormatId('pptx')).toBe(true)
    expect(isExportFormatId('fig')).toBe(false)
    expect(isExportFormatId('PNG')).toBe(false)
  })
})
