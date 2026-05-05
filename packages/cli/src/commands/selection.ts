import { defineCommand } from 'citty'

import { rpc } from '#cli/app-client'
import { bold, entity, fmtList, formatType, printError } from '#cli/format'

interface SelectionNode {
  id: string
  name: string
  type: string
  width: number
  height: number
  xpath: string | null
}

export default defineCommand({
  meta: { description: 'Get current selection from the running app' },
  args: {
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const nodes = await rpc<SelectionNode[]>('selection')

      if (args.json) {
        console.log(JSON.stringify(nodes, null, 2))
        return
      }

      if (nodes.length === 0) {
        console.log('\n  No nodes selected.\n')
        return
      }

      console.log('')
      console.log(bold(`  ${nodes.length} selected node${nodes.length !== 1 ? 's' : ''}`))
      console.log('')
      console.log(
        fmtList(
          nodes.map((n) => ({
            header: entity(formatType(n.type), n.name, n.id),
            details: {
              size: `${n.width}×${n.height}`,
              ...(n.xpath ? { xpath: n.xpath } : {})
            }
          }))
        )
      )
      console.log('')
    } catch (error) {
      printError(error)
      process.exit(1)
    }
  }
})
