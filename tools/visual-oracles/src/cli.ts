import { defineCommand, runMain } from 'citty'

import { operationCommand } from './commands/operation'

const main = defineCommand({
  meta: {
    name: 'visual-oracles',
    description: 'Figma and OpenPencil visual comparison tools'
  },
  subCommands: {
    compare: () => import('./commands/compare').then((module) => module.default),
    bisect: operationCommand(
      'bisect',
      'Bisect page children to isolate visual differences',
      'tools/visual-oracles/src/operations/bisect.ts'
    ),
    'export-fixtures': operationCommand(
      'export-fixtures',
      'Export configured OpenPencil fixture images',
      'tools/visual-oracles/src/operations/export-fixtures.ts'
    ),
    analyze: () => import('./commands/analyze').then((module) => module.default),
    'activate-tab': operationCommand(
      'activate-tab',
      'Bring a Figma desktop tab to the front by title before an oracle capture',
      'tools/visual-oracles/src/operations/activate-tab.ts'
    ),
    'update-report': operationCommand(
      'update-report',
      'Update the visual comparison report',
      'tools/visual-oracles/src/operations/update-report.ts'
    )
  }
})

await runMain(main)
