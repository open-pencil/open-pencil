import { getToolName, isToolUIPart } from 'ai'
import type { UIDataTypes, UIMessagePart, UITools } from 'ai'
import { isValid } from 'js-base64'

export type ChatMessagePart = UIMessagePart<UIDataTypes, UITools>
export type ToolCallPart = Extract<ChatMessagePart, { toolCallId: string }>

const MCP_PREFIX = /^mcp__[^_]+__/
const SUMMARY_LENGTH = 60
const IMAGE_MEDIA_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function truncate(text: string): string {
  const line = text.trim().split('\n')[0]?.trim() ?? ''
  return line.length > SUMMARY_LENGTH ? `${line.slice(0, SUMMARY_LENGTH - 1)}…` : line
}

export function toolName(part: ToolCallPart): string {
  return getToolName(part).replace(MCP_PREFIX, '')
}

export function toolDisplayName(part: ToolCallPart): string {
  return toolName(part)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** The root element's opening tag, which may still be streaming in. */
const ROOT_TAG = /<([A-Z][\w.]*)([^>]*)/

/** The element and name a JSX source opens with, such as `Frame "Pricing"`. */
function jsxSummary(jsx: string): string {
  const root = ROOT_TAG.exec(jsx)
  if (!root) return ''
  const [, element, attributes = ''] = root
  // Only the root's own attributes: a child's name must not label the root.
  const name = /\bname=["'{]+([^"'}]+)/.exec(attributes)?.[1]
  return name ? `${element} “${truncate(name)}”` : element
}

const SUMMARY_FIELDS = ['name', 'query', 'text', 'question', 'path', 'id'] as const

/** A one-line description of what a call does, read from its (possibly partial) input. */
export function toolSummary(part: ToolCallPart): string {
  const input = part.input
  if (!isRecord(input)) return ''
  if (typeof input.jsx === 'string') return jsxSummary(input.jsx)
  if (typeof input.code === 'string') return truncate(input.code)
  if (Array.isArray(input.ids) && input.ids.length > 1) return `${input.ids.length} nodes`
  for (const field of SUMMARY_FIELDS) {
    const value = input[field]
    if (typeof value === 'string' && value.trim()) return truncate(value)
  }
  return ''
}

function stringIds(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item === 'string') return [item]
    return isRecord(item) && typeof item.id === 'string' ? [item.id] : []
  })
}

/** Nodes a call targeted or produced, for chips that bring them into view. */
export function toolNodeIds(part: ToolCallPart): string[] {
  const ids = new Set<string>()
  const { input } = part
  if (isRecord(input)) {
    for (const key of ['id', 'ids', 'replace_id', 'parent_id', 'parentId']) {
      for (const id of stringIds(input[key])) ids.add(id)
    }
  }
  if (part.state === 'output-available' && isRecord(part.output)) {
    const { output } = part
    if (typeof output.deleted !== 'string') {
      for (const key of ['id', 'ids', 'selection', 'results', 'created']) {
        for (const id of stringIds(output[key])) ids.add(id)
      }
    }
  }
  return [...ids]
}

export function toolErrorText(part: ToolCallPart): string | null {
  if (part.state === 'output-error') return part.errorText
  if (part.state !== 'output-available' || !isRecord(part.output)) return null
  const { error } = part.output
  return typeof error === 'string' ? error : null
}

/** An image the tool returned for the model, such as `export_image`, as a data URL. */
export function toolImage(part: ToolCallPart): string | null {
  if (part.state !== 'output-available' || !isRecord(part.output)) return null
  const { base64, mimeType } = part.output
  if (typeof base64 !== 'string' || typeof mimeType !== 'string') return null
  if (!IMAGE_MEDIA_TYPES.has(mimeType) || !isValid(base64)) return null
  return `data:${mimeType};base64,${base64}`
}

/** Output with large binary payloads elided, for display as JSON. */
export function displayedToolOutput(part: ToolCallPart): unknown {
  if (part.state !== 'output-available') return undefined
  const { output } = part
  if (!isRecord(output) || typeof output.base64 !== 'string') return output
  return { ...output, base64: `<${output.base64.length} base64 characters>` }
}

/** The source a call writes, shown highlighted instead of as a JSON string. */
export function toolSource(
  part: ToolCallPart
): { code: string; language: 'design-jsx' | 'javascript' } | null {
  const input = part.input
  if (!isRecord(input)) return null
  if (typeof input.jsx === 'string') return { code: input.jsx, language: 'design-jsx' }
  if (typeof input.code === 'string') return { code: input.code, language: 'javascript' }
  return null
}

/** Whether a call has input worth showing: source, or at least one argument. */
export function toolHasInput(part: ToolCallPart): boolean {
  return toolSource(part) !== null || (isRecord(part.input) && Object.keys(part.input).length > 0)
}

export type MessagePartGroup =
  | { kind: 'part'; part: ChatMessagePart; index: number }
  | { kind: 'tools'; parts: { part: ToolCallPart; index: number }[] }

/** Consecutive tool calls form one group, so a long run can collapse into a single row. */
export function groupMessageParts(parts: readonly ChatMessagePart[]): MessagePartGroup[] {
  const groups: MessagePartGroup[] = []
  parts.forEach((part, index) => {
    // Step boundaries are not rendered, so they must not split a run of calls.
    if (part.type === 'step-start') return
    if (!isToolUIPart(part)) {
      groups.push({ kind: 'part', part, index })
      return
    }
    const last = groups.at(-1)
    if (last?.kind === 'tools') last.parts.push({ part, index })
    else groups.push({ kind: 'tools', parts: [{ part, index }] })
  })
  return groups
}
