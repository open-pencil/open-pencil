import type { TreeNode } from 'agentfmt'
import { defineCommand } from 'citty'

import type { TreeNodeResult, TreeResult } from '@open-pencil/core/rpc'

import { fmtTree, printError, entity, formatType } from '#cli/format'
import { loadRpcData } from '#cli/rpc-data'

function toAgentfmtTree(node: TreeNodeResult, maxDepth: number, depth = 0): TreeNode {
  const treeNode: TreeNode = {
    header: entity(formatType(node.type), node.name, node.id)
  }
  if (node.children && depth < maxDepth) {
    treeNode.children = node.children.map((c) => toAgentfmtTree(c, maxDepth, depth + 1))
  }
  return treeNode
}

export default defineCommand({
  meta: { description: 'Print the node tree' },
  args: {
    file: {
      type: 'positional',
      description: 'Document file path (omit to connect to running app)',
      required: false
    },
    page: { type: 'string', description: 'Page name (default: first page)' },
    depth: { type: 'string', description: 'Max depth (default: unlimited)' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const data = await loadRpcData<TreeResult | { error: string }>(args.file, 'tree', {
      page: args.page,
      depth: args.depth ? Number(args.depth) : undefined
    })
    const maxDepth = args.depth ? Number(args.depth) : Infinity

    if ('error' in data) {
      printError(data.error)
      process.exit(1)
    }

    if (args.json) {
      console.log(JSON.stringify(data.children, null, 2))
      return
    }

    const root = {
      header: entity(formatType(data.page.type), data.page.name, data.page.id),
      children: data.children.map((c) => toAgentfmtTree(c, maxDepth))
    }

    console.log('')
    console.log(fmtTree(root, { maxDepth }))
    console.log('')
  }
})
