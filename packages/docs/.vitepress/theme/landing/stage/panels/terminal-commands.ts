import type { LandingMessages } from '#docs/theme/landing/content/messages'
import type { Component } from 'vue'
import IconCode from '~icons/lucide/code'
import IconCopyPlus from '~icons/lucide/copy-plus'
import IconListTree from '~icons/lucide/list-tree'
import IconMousePointerClick from '~icons/lucide/mouse-pointer-click'
import IconWand from '~icons/lucide/wand-sparkles'

import type { TreeNodeResult, TreeResult } from '@open-pencil/core/rpc'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { createAutomationCommandHandlers } from '@/app/automation/bridge/handlers'
import type { EditorStore } from '@/app/editor/active-store'

/**
 * The CLI reaches a running app through `createAutomationCommandHandlers`. The landing page
 * calls that same handler in-process, so each command below does exactly what
 * `openpencil <command>` does against the desktop or web app; only the transport is skipped.
 */
const { handleRequest } = createAutomationCommandHandlers(makeFigmaFromStore)

export interface EditorCommand {
  /** Also the key of the command's label in the landing message catalogs. */
  id: keyof LandingMessages['stage']['terminal']
  icon: Component
  /** The command line as a user would type it. */
  line: string
  run: (store: EditorStore) => Promise<string>
}

interface AutomationResponse {
  ok?: boolean
  result?: unknown
  error?: string
}

async function request(store: EditorStore, command: string, args: unknown): Promise<unknown> {
  const response = (await handleRequest(store, command, args)) as AutomationResponse
  if (response.error) throw new Error(response.error)
  return response.result
}

const TYPE_LABELS: Record<string, string> = {
  CANVAS: 'page',
  RECTANGLE: 'rect',
  COMPONENT_SET: 'component-set'
}

function entity(node: { type: string; name: string; id: string }): string {
  return `[${TYPE_LABELS[node.type] ?? node.type.toLowerCase()}] "${node.name}" (${node.id})`
}

function treeLines(node: TreeNodeResult, index: number, depth: number): string[] {
  const lines = [`${'  '.repeat(depth)}[${index}] ${entity(node)}`]
  node.children?.forEach((child, childIndex) => {
    lines.push(...treeLines(child, childIndex, depth + 1))
  })
  return lines
}

async function printTree(store: EditorStore, depth: number): Promise<string> {
  const page = store.graph.getNode(store.state.currentPageId)
  const data = (await request(store, 'tree', { page: page?.name, depth })) as TreeResult
  return [
    `[0] ${entity(data.page)}`,
    ...data.children.flatMap((child, index) => treeLines(child, index, 1))
  ].join('\n')
}

interface SelectionNode {
  id: string
  name: string
  type: string
  width: number
  height: number
  xpath: string | null
}

async function printSelection(store: EditorStore): Promise<string> {
  const nodes = (await request(store, 'selection', {})) as SelectionNode[]
  if (nodes.length === 0) return 'No nodes selected. Click a layer on the canvas and run it again.'
  return [
    `${nodes.length} selected node${nodes.length === 1 ? '' : 's'}`,
    '',
    ...nodes.flatMap((node) => [
      entity(node),
      `  size: ${node.width}×${node.height}`,
      ...(node.xpath ? [`  xpath: ${node.xpath}`] : [])
    ])
  ].join('\n')
}

async function printTailwind(store: EditorStore): Promise<string> {
  const selected = [...store.state.selectedIds]
  if (selected.length === 0) return 'Select a layer first: the export follows the selection.'
  const result = (await request(store, 'export_jsx', { nodeIds: selected, style: 'tailwind' })) as {
    jsx: string
  }
  return result.jsx
}

const RESTYLE = `const accent = { r: 0.96, g: 0.33, b: 0.24 }
for (const node of figma.currentPage.findAll(n => n.name === 'Button')) {
  node.fills = [{ ...node.fills[0], color: accent }]
  node.cornerRadius = 22
}
return 'Restyled every button'`

const ADD_PLAN = `const plans = figma.currentPage.findOne(n => n.name === 'Plans')
const plan = plans.children[0].clone()
plan.name = 'Plan / Cloud'
plan.findOne(n => n.name === 'Plan name').characters = 'Cloud'
plan.findOne(n => n.name === 'Amount').characters = 'Opt-in'
plan.findOne(n => n.name === 'Period').characters = 'never required'
plan.findOne(n => n.name === 'Summary').characters = 'Sync and share when you want to.'
plans.appendChild(plan)
return plan.name + ' added'`

/** The real CLI reads the script from stdin, so multi-line code needs no shell quoting. */
function evalLine(code: string): string {
  return `openpencil eval --stdin <<'JS'\n${code}\nJS`
}

async function runEval(store: EditorStore, code: string): Promise<string> {
  const result = await request(store, 'eval', { code })
  store.zoomToFit()
  if (result === null || result === undefined) return ''
  return typeof result === 'string' ? result : JSON.stringify(result, null, 2)
}

export const EDITOR_COMMANDS: EditorCommand[] = [
  {
    id: 'tree',
    icon: IconListTree,
    line: 'openpencil tree --depth 3',
    run: (store) => printTree(store, 3)
  },
  {
    id: 'restyle',
    icon: IconWand,
    line: evalLine(RESTYLE),
    run: (store) => runEval(store, RESTYLE)
  },
  {
    id: 'addPlan',
    icon: IconCopyPlus,
    line: evalLine(ADD_PLAN),
    run: (store) => runEval(store, ADD_PLAN)
  },
  {
    id: 'selection',
    icon: IconMousePointerClick,
    line: 'openpencil selection',
    run: printSelection
  },
  {
    id: 'export',
    icon: IconCode,
    line: 'openpencil export -f tailwind-jsx',
    run: printTailwind
  }
]
