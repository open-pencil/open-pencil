import { readFile, writeFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'

import type * as acp from '@agentclientprotocol/sdk'

import { ALL_TOOLS, FigmaAPI, parseFigFile, computeAllLayouts, SceneGraph, exportFigFile } from '@open-pencil/core'

import type { ToolDef } from '@open-pencil/core'

export interface CreateAgentOptions {
  enableEval?: boolean
  fileRoot?: string | null
}

interface AgentSession {
  graph: SceneGraph | null
  currentPageId: string | null
  cwd: string
  pendingPrompt: AbortController | null
}

const TOOL_KIND_MAP: Record<string, acp.ToolKind> = {
  get_selection: 'read',
  get_page_tree: 'read',
  get_node: 'read',
  find_nodes: 'search',
  list_pages: 'read',
  list_variables: 'read',
  list_collections: 'read',
  node_bounds: 'read',
  render: 'read',
  create_shape: 'edit',
  set_fill: 'edit',
  set_stroke: 'edit',
  set_effects: 'edit',
  update_node: 'edit',
  set_layout: 'edit',
  set_constraints: 'edit',
  delete_node: 'delete',
  clone_node: 'edit',
  rename_node: 'edit',
  reparent_node: 'move',
  select_nodes: 'other',
  group_nodes: 'edit',
  ungroup_node: 'edit',
  create_component: 'edit',
  create_instance: 'edit',
  switch_page: 'other',
  eval: 'execute',
  node_move: 'move',
  set_rotation: 'edit',
  set_opacity: 'edit',
  set_radius: 'edit',
  set_min_max: 'edit',
  set_text: 'edit',
  set_font: 'edit',
  set_font_range: 'edit',
  set_text_resize: 'edit',
  set_visible: 'edit',
  set_blend: 'edit',
  set_locked: 'edit',
  set_stroke_align: 'edit'
}

function toolKind(name: string): acp.ToolKind {
  return TOOL_KIND_MAP[name] ?? 'other'
}

function resolveAndCheckPath(filePath: string, fileRoot: string | null): string {
  const resolved = resolve(filePath)
  if (!fileRoot) return resolved
  const rel = relative(fileRoot, resolved)
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) return resolved
  throw new Error(`Path "${filePath}" is outside allowed root "${fileRoot}"`)
}

interface BuiltinTool {
  name: string
  description: string
  execute: (args: Record<string, unknown>, session: AgentSession) => Promise<unknown>
}

function builtinTools(fileRoot: string | null): BuiltinTool[] {
  return [
    {
      name: 'open_file',
      description: 'Open a .fig file for editing. Must be called before using other tools.',
      async execute(args, session) {
        const path = resolveAndCheckPath(args.path as string, fileRoot)
        const buf = await readFile(path)
        session.graph = await parseFigFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
        computeAllLayouts(session.graph)
        const pages = session.graph.getPages()
        session.currentPageId = pages[0]?.id ?? null
        return { pages: pages.map((p) => ({ id: p.id, name: p.name })), currentPage: pages[0]?.name }
      }
    },
    {
      name: 'save_file',
      description: 'Save the current document to a .fig file.',
      async execute(args, session) {
        if (!session.graph) throw new Error('No document loaded')
        const path = resolveAndCheckPath(args.path as string, fileRoot)
        const data = await exportFigFile(session.graph)
        await writeFile(path, new Uint8Array(data))
        return { saved: path, bytes: data.byteLength }
      }
    },
    {
      name: 'new_document',
      description: 'Create a new empty document with a blank page.',
      async execute(_args, session) {
        session.graph = new SceneGraph()
        const pages = session.graph.getPages()
        session.currentPageId = pages[0]?.id ?? null
        return { page: pages[0]?.name, id: session.currentPageId }
      }
    }
  ]
}

export function createAgent(
  connection: acp.AgentSideConnection,
  version: string,
  options: CreateAgentOptions = {}
): acp.Agent {
  const enableEval = options.enableEval ?? true
  const fileRoot =
    options.fileRoot === null || options.fileRoot === undefined ? null : resolve(options.fileRoot)

  const sessions = new Map<string, AgentSession>()
  const builtins = builtinTools(fileRoot)
  const coreTools = ALL_TOOLS.filter((t) => enableEval || t.name !== 'eval')

  function getSession(sessionId: string): AgentSession {
    const session = sessions.get(sessionId)
    if (!session) throw new Error(`Session ${sessionId} not found`)
    return session
  }

  function makeFigma(session: AgentSession): FigmaAPI {
    if (!session.graph) throw new Error('No document loaded. Use open_file or new_document first.')
    const api = new FigmaAPI(session.graph)
    if (session.currentPageId) api.currentPage = api.wrapNode(session.currentPageId)
    return api
  }

  function allToolDescriptions(): acp.AvailableCommand[] {
    const commands: acp.AvailableCommand[] = []

    for (const bt of builtins) {
      commands.push({
        name: bt.name,
        description: bt.description,
        input: { hint: 'JSON arguments or key=value pairs' }
      })
    }

    for (const def of coreTools) {
      commands.push({
        name: def.name,
        description: def.description,
        input: { hint: 'JSON arguments or key=value pairs' }
      })
    }

    return commands
  }

  return {
    async initialize(_params) {
      return {
        protocolVersion: 1,
        agentCapabilities: {
          loadSession: false,
          promptCapabilities: {
            embeddedContext: true
          }
        },
        agentInfo: {
          name: 'open-pencil',
          title: 'OpenPencil',
          version
        },
        authMethods: []
      }
    },

    async authenticate(_params) {
      return {}
    },

    async newSession(params) {
      const sessionId = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

      sessions.set(sessionId, {
        graph: null,
        currentPageId: null,
        cwd: params.cwd,
        pendingPrompt: null
      })

      return {
        sessionId,
        availableCommands: allToolDescriptions()
      }
    },

    async prompt(params) {
      const session = getSession(params.sessionId)

      session.pendingPrompt?.abort()
      session.pendingPrompt = new AbortController()
      const signal = session.pendingPrompt.signal

      const userText = params.prompt
        .filter((b): b is acp.TextContent & { type: 'text' } => b.type === 'text')
        .map((b) => b.text)
        .join('\n')

      let toolName: string | undefined
      let toolArgs: Record<string, unknown> = {}

      try {
        const parsed = JSON.parse(userText)
        if (parsed && typeof parsed === 'object' && typeof parsed.tool === 'string') {
          toolName = parsed.tool
          toolArgs = parsed.args ?? {}
        }
      } catch {
        // Not JSON — try slash-command style: `/tool_name {"arg": "val"}`
        const match = userText.match(/^\/(\S+)\s*(.*)$/s)
        if (match) {
          toolName = match[1]
          if (match[2].trim()) {
            try {
              toolArgs = JSON.parse(match[2])
            } catch {
              toolArgs = { query: match[2].trim() }
            }
          }
        }
      }

      if (!toolName) {
        await connection.sessionUpdate({
          sessionId: params.sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: {
              type: 'text',
              text: formatHelp(builtins, coreTools)
            }
          }
        })
        session.pendingPrompt = null
        return { stopReason: 'end_turn' }
      }

      if (signal.aborted) {
        session.pendingPrompt = null
        return { stopReason: 'cancelled' }
      }

      const toolCallId = `call_${Date.now()}`
      const builtin = builtins.find((b) => b.name === toolName)
      const coreTool = coreTools.find((t) => t.name === toolName)

      if (!builtin && !coreTool) {
        await connection.sessionUpdate({
          sessionId: params.sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: {
              type: 'text',
              text: `Unknown tool: \`${toolName}\`. Use \`/help\` to list available tools.`
            }
          }
        })
        session.pendingPrompt = null
        return { stopReason: 'end_turn' }
      }

      const kind = toolKind(toolName)

      await connection.sessionUpdate({
        sessionId: params.sessionId,
        update: {
          sessionUpdate: 'tool_call',
          toolCallId,
          title: toolName,
          kind,
          status: 'pending',
          rawInput: toolArgs
        }
      })

      await connection.sessionUpdate({
        sessionId: params.sessionId,
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId,
          status: 'in_progress'
        }
      })

      try {
        let result: unknown

        if (builtin) {
          result = await builtin.execute(toolArgs, session)
        } else if (coreTool) {
          result = await coreTool.execute(makeFigma(session), toolArgs)
        }

        await connection.sessionUpdate({
          sessionId: params.sessionId,
          update: {
            sessionUpdate: 'tool_call_update',
            toolCallId,
            status: 'completed',
            content: [
              {
                type: 'content',
                content: {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              }
            ],
            rawOutput: result as Record<string, unknown>
          }
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        await connection.sessionUpdate({
          sessionId: params.sessionId,
          update: {
            sessionUpdate: 'tool_call_update',
            toolCallId,
            status: 'failed',
            content: [
              {
                type: 'content',
                content: {
                  type: 'text',
                  text: JSON.stringify({ error: msg })
                }
              }
            ]
          }
        })
      }

      session.pendingPrompt = null
      return { stopReason: 'end_turn' }
    },

    async cancel(params) {
      sessions.get(params.sessionId)?.pendingPrompt?.abort()
    }
  }
}

function formatHelp(builtins: BuiltinTool[], coreTools: ToolDef[]): string {
  const lines = [
    '# OpenPencil ACP Agent',
    '',
    'Send commands as `/tool_name {"arg": "value"}` or JSON `{"tool": "tool_name", "args": {...}}`.',
    '',
    '## File operations',
    ''
  ]

  for (const bt of builtins) {
    lines.push(`- \`/${bt.name}\` — ${bt.description}`)
  }

  lines.push('', '## Design tools', '')

  for (const def of coreTools) {
    lines.push(`- \`/${def.name}\` — ${def.description}`)
  }

  return lines.join('\n')
}
