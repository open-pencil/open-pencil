import { defineCommand } from 'citty'

import { operationCommand } from './operation'

export default defineCommand({
  meta: { name: 'analyze', description: 'Analyze specialized Figma visual oracles' },
  subCommands: {
    pattern: operationCommand(
      'pattern',
      'Analyze pattern-paint oracle captures',
      'tools/visual-oracles/src/operations/analyze-pattern.ts'
    ),
    'text-decoration': operationCommand(
      'text-decoration',
      'Analyze text-decoration oracle captures',
      'tools/visual-oracles/src/operations/analyze-text-decoration.ts'
    )
  }
})
