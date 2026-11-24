import { CLOUD_MCP_CATALOG_PATH, cloudMCPCatalogIsCurrent } from '#mcp-catalog/catalog'
import dedent from 'dedent'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

if (!(await cloudMCPCatalogIsCurrent(await resolveWorkspaceRoot(process.cwd())))) {
  console.error(dedent`
    ${CLOUD_MCP_CATALOG_PATH} is not what Core's tools generate.
    Run bun run generate:mcp-catalog.
  `)
  process.exitCode = 1
}
