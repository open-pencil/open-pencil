import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

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

/** Every tool an MCP client may call through a Cloud server, as the server lists it. */
export function cloudMCPCatalog() {
  return (
    getMCPToolDefinitions()
      // Running code an app sends stays a choice for whoever runs a local server.
      .filter((def) => def.availability === 'default' && isToolExposed(def, 'mcp'))
      .map((def) => ({
        name: def.name,
        description: def.description,
        mutates: toolChangesDocument(def),
        inputSchema: toolInputSchema(v.strictObject(toolInputFor(def, 'mcp').entries))[
          '~standard'
        ].jsonSchema.input({ target: INPUT_SCHEMA_TARGET })
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
