import { readFile, writeFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import {
  ALL_TOOLS,
  FigmaAPI,
  parseFigFile,
  computeAllLayouts,
  SceneGraph,
  renderNodesToImage,
  SkiaRenderer
} from '@open-pencil/core'

import type { ToolDef, ParamDef, ParamType, ExportFormat } from '@open-pencil/core'
import type { CanvasKit } from 'canvaskit-wasm'

type McpContent = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }
type McpResult = { content: McpContent[]; isError?: boolean }
export interface CreateServerOptions {
  enableEval?: boolean
  fileRoot?: string | null
}

function ok(data: unknown): McpResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

function fail(e: unknown): McpResult {
  const msg = e instanceof Error ? e.message : String(e)
  return { content: [{ type: 'text', text: JSON.stringify({ error: msg }) }], isError: true }
}

function paramToZod(param: ParamDef): z.ZodTypeAny {
  const typeMap: Record<ParamType, () => z.ZodTypeAny> = {
    string: () =>
      param.enum
        ? z.enum(param.enum as [string, ...string[]]).describe(param.description)
        : z.string().describe(param.description),
    number: () => {
      let s = z.number()
      if (param.min !== undefined) s = s.min(param.min)
      if (param.max !== undefined) s = s.max(param.max)
      return s.describe(param.description)
    },
    boolean: () => z.boolean().describe(param.description),
    color: () => z.string().describe(param.description),
    'string[]': () => z.array(z.string()).min(1).describe(param.description)
  }

  const schema = typeMap[param.type]()
  return param.required ? schema : schema.optional()
}

let ckInstance: CanvasKit | null = null

async function getCanvasKit(): Promise<CanvasKit> {
  if (ckInstance) return ckInstance
  const CanvasKitInit = (await import('canvaskit-wasm/full')).default
  const ckPath = import.meta.resolve('canvaskit-wasm/full')
  const binDir = new URL('.', ckPath).pathname
  ckInstance = await CanvasKitInit({ locateFile: (file: string) => binDir + file })
  return ckInstance
}

export function createServer(version: string, options: CreateServerOptions = {}): McpServer {
  const server = new McpServer({ name: 'open-pencil', version })
  const enableEval = options.enableEval ?? true
  const fileRoot = options.fileRoot === null || options.fileRoot === undefined
    ? null
    : resolve(options.fileRoot)

  let graph: SceneGraph | null = null
  let currentPageId: string | null = null

  function makeFigma(): FigmaAPI {
    if (!graph) throw new Error('No document loaded. Use open_file or new_document first.')
    const api = new FigmaAPI(graph)
    if (currentPageId) api.currentPage = api.wrapNode(currentPageId)
    api.exportImage = async (nodeIds, opts) => {
      const ck = await getCanvasKit()
      const surface = ck.MakeSurface(1, 1)!
      const renderer = new SkiaRenderer(ck, surface)
      renderer.viewportWidth = 1
      renderer.viewportHeight = 1
      renderer.dpr = 1
      const pageId = currentPageId ?? graph!.getPages()[0]?.id ?? graph!.rootId
      return renderNodesToImage(ck, renderer, graph!, pageId, nodeIds, {
        scale: opts.scale ?? 1,
        format: (opts.format ?? 'PNG') as ExportFormat
      })
    }
    return api
  }

  function resolveAndCheckPath(filePath: string): string {
    const resolved = resolve(filePath)
    if (!fileRoot) return resolved
    const rel = relative(fileRoot, resolved)
    if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) {
      return resolved
    }
    throw new Error(`Path "${filePath}" is outside allowed root "${fileRoot}"`)
  }

  function registerTool(def: ToolDef) {
    const shape: Record<string, z.ZodTypeAny> = {}
    for (const [key, param] of Object.entries(def.params)) {
      shape[key] = paramToZod(param)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic schema from ToolDef params
    server.registerTool(def.name, { description: def.description, inputSchema: z.object(shape) } as any, async (args: any) => {
      try {
        const result = await def.execute(makeFigma(), args as Record<string, unknown>) as Record<string, unknown>
        if (result && typeof result === 'object' && 'base64' in result && 'mimeType' in result) {
          return {
            content: [{ type: 'image' as const, data: result.base64 as string, mimeType: result.mimeType as string }]
          }
        }
        return ok(result)
      } catch (e) {
        return fail(e)
      }
    })
  }

  const register = server.registerTool.bind(server) as (...args: unknown[]) => void
  register(
    'open_file',
    {
      description: 'Open a .fig file for editing. Must be called before using other tools.',
      inputSchema: z.object({ path: z.string().describe('Absolute path to a .fig file') })
    },
    async ({ path: filePath }: { path: string }) => {
      try {
        const path = resolveAndCheckPath(filePath)
        const buf = await readFile(path)
        graph = await parseFigFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
        computeAllLayouts(graph)
        const pages = graph.getPages()
        currentPageId = pages[0]?.id ?? null
        return ok({ pages: pages.map((p) => ({ id: p.id, name: p.name })), currentPage: pages[0]?.name })
      } catch (e) {
        return fail(e)
      }
    }
  )

  register(
    'save_file',
    {
      description: 'Save the current document to a .fig file.',
      inputSchema: z.object({ path: z.string().describe('Absolute path to save the .fig file') })
    },
    async ({ path: filePath }: { path: string }) => {
      try {
        if (!graph) throw new Error('No document loaded')
        const { exportFigFile } = await import('@open-pencil/core')
        const path = resolveAndCheckPath(filePath)
        const data = await exportFigFile(graph)
        await writeFile(path, new Uint8Array(data))
        return ok({ saved: path, bytes: data.byteLength })
      } catch (e) {
        return fail(e)
      }
    }
  )

  register(
    'new_document',
    {
      description: 'Create a new empty document with a blank page.',
      inputSchema: z.object({})
    },
    async () => {
      try {
        graph = new SceneGraph()
        const pages = graph.getPages()
        currentPageId = pages[0]?.id ?? null
        return ok({ page: pages[0]?.name, id: currentPageId })
      } catch (e) {
        return fail(e)
      }
    }
  )

  for (const tool of ALL_TOOLS) {
    if (!enableEval && tool.name === 'eval') continue
    registerTool(tool)
  }

  return server
}
