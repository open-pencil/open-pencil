import { defineCommand } from 'citty'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core'

import { bold, fmtList, kv } from '../format'

const io = new IORegistry(BUILTIN_IO_FORMATS)

function supportLabels(format: ReturnType<IORegistry['listFormats']>[number]): string[] {
  const labels: string[] = []
  if (format.support.readDocument) labels.push('read')
  if (format.support.writeDocument) labels.push('write')
  if (format.support.exportDocument) labels.push('export-document')
  if (format.support.exportPage) labels.push('export-page')
  if (format.support.exportSelection) labels.push('export-selection')
  if (format.support.exportNode) labels.push('export-node')
  return labels
}

export default defineCommand({
  meta: { description: 'List supported document and export formats' },
  args: {
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const formats = io.listFormats().map((format) => ({
      id: format.id,
      label: format.label,
      role: format.role,
      category: format.category,
      extensions: format.extensions,
      mimeTypes: format.mimeTypes,
      support: supportLabels(format)
    }))

    if (args.json) {
      console.log(JSON.stringify(formats, null, 2))
      return
    }

    console.log('')
    console.log(bold(`  ${formats.length} format${formats.length !== 1 ? 's' : ''}`))
    console.log('')
    console.log(
      fmtList(
        formats.map((format) => ({
          header: `${format.label} (${format.id})`,
          details: {
            role: format.role,
            category: format.category,
            ext: format.extensions.map((ext) => `.${ext}`).join(', '),
            support: format.support.join(', '),
            mime: format.mimeTypes.join(', ')
          }
        })),
        { compact: true }
      )
    )
    console.log('')
    console.log(
      kv(
        'Readable',
        io
          .listReadableFormats()
          .map((f) => f.id)
          .join(', ') || 'none'
      )
    )
    console.log(
      kv(
        'Writable',
        io
          .listWritableFormats()
          .map((f) => f.id)
          .join(', ') || 'none'
      )
    )
    console.log('')
  }
})
