import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { omit } from 'es-toolkit/object'
import * as v from 'valibot'

import { isToolExposed, toolChangesDocument, toolInputFor } from '@open-pencil/core/tools'
import { getMCPToolDefinitions, toolInputSchema } from '@open-pencil/mcp/tools'

/**
 * The design tools a Cloud server lists to MCP clients, generated from Core's: Cloud holds no
 * editor, so it lists them from this file and an editor with the document open runs them.
 */
export const CLOUD_MCP_CATALOG_PATH = 'packages/cloud/src/server/mcp/design-tools.json'

/** The JSON Schema dialect MCP tool inputs are written in. */
const INPUT_SCHEMA_TARGET = 'draft-2020-12'

/**
 * Tools that reach past the document an app was granted: the person's paid search provider, and
 * their component libraries.
 */
const OUTSIDE_DOCUMENT = new Set(['search_web', 'list_libraries'])

/** Tools whose `path` names a file the local MCP server writes (`FILE_OUTPUTS` in `@open-pencil/mcp`). */
const FILE_OUTPUT_TOOLS = new Set(['export_svg', 'get_jsx', 'export_image', 'export_pdf'])

/** A tool's input without the file it would write, which a server has no disk of the caller's for. */
function remoteEntries(name: string, entries: v.ObjectEntries): v.ObjectEntries {
  return FILE_OUTPUT_TOOLS.has(name) ? omit(entries, ['path']) : entries
}

/** Every tool an MCP client may call through a Cloud server, as the server lists it. */
export function cloudMCPCatalog() {
  return (
    getMCPToolDefinitions()
      // Running code an app sends stays a choice for whoever runs a local server.
      .filter((def) => def.availability === 'default' && isToolExposed(def, 'mcp'))
      .filter((def) => !OUTSIDE_DOCUMENT.has(def.name))
      .map((def) => ({
        name: def.name,
        description: def.description,
        mutates: toolChangesDocument(def),
        readOnly: def.execution.mutation === 'none',
        inputSchema: toolInputSchema(
          v.strictObject(remoteEntries(def.name, toolInputFor(def, 'mcp').entries))
        )['~standard'].jsonSchema.input({ target: INPUT_SCHEMA_TARGET })
      }))
  )
}

export function renderCloudMCPCatalog(): string {
  return `${JSON.stringify(cloudMCPCatalog(), null, 2)}\n`
}

export async function writeCloudMCPCatalog(root: string): Promise<void> {
  const target = join(root, CLOUD_MCP_CATALOG_PATH)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, renderCloudMCPCatalog())
}

/** Whether the catalog in the repository is what Core's tools generate now. */
export async function cloudMCPCatalogIsCurrent(root: string): Promise<boolean> {
  const actual = await readFile(join(root, CLOUD_MCP_CATALOG_PATH), 'utf8').catch(
    (error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null
      throw error
    }
  )
  return actual === renderCloudMCPCatalog()
}
