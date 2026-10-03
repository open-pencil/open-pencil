import { defineCommand } from 'citty'

import { operationCommand } from './operation'

export default defineCommand({
  meta: { name: 'compare', description: 'Compare Figma and OpenPencil rendering' },
  subCommands: {
    node: operationCommand(
      'node',
      'Compare one Figma node or clipboard selection',
      'tools/generate/visual-oracles/src/operations/compare/node.ts'
    ),
    document: operationCommand(
      'document',
      'Compare exact imported-document targets from a manifest',
      'tools/generate/visual-oracles/src/operations/compare/document.ts'
    ),
    digest: operationCommand(
      'digest',
      'Capture every page a reader produces, and diff it against an earlier capture',
      'tools/generate/visual-oracles/src/operations/compare/digest.ts'
    ),
    'interpreted-document': operationCommand(
      'interpreted-document',
      'Compare an interpreted archive with the same document opened in Figma',
      'tools/generate/visual-oracles/src/operations/compare/interpreted-document.ts'
    )
  }
})
