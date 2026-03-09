import { defineCommand } from 'citty'

import { loadDocument } from '../headless'
import { isAppMode, requireFile, rpc } from '../app-client'
import { fmtTree, printError, entity, formatType } from '../format'
import { executeRpcCommand } from '@open-pencil/core'

import type { TreeResult, TreeNodeResult } from '@open-pencil/core'
import type { TreeNode } from 'agentfmt'

function toAgentfmtTree(node: TreeNodeResult, maxDepth: number, depth = 0): TreeNode {
  const treeNode: TreeNode = {
    header: entity(formatType(node.type), node.name, node.id)
  }
  if (node.children && depth < maxDepth) {
    treeNode.children = node.children.map((c) => toAgentfmtTree(c, maxDepth, depth + 1))
  }
  return treeNode
}

async function getData(file: string | undefined, args: { page?: string; depth?: string }): Promise<TreeResult | { error: string }> {
  const rpcArgs = { page: args.page, depth: args.depth ? Number(args.depth) : undefined }
  if (isAppMode(file)) return rpc<TreeResult>('tree', rpcArgs)
  const graph = await loadDocument(requireFile(file))
  return executeRpcCommand(graph, 'tree', rpcArgs) as TreeResult | { error: string }
}

export default defineCommand({
  meta: { description: 'Print the node tree' },
  args: {
    file: { type: 'positional', description: '.fig file path (omit to connect to running app)', required: false },
    page: { type: 'string', description: 'Page name (default: first page)' },
    depth: { type: 'string', description: 'Max depth (default: unlimited)' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const data = await getData(args.file, args)
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
