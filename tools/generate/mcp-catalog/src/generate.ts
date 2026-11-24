import { writeCloudMCPCatalog } from '#mcp-catalog/catalog'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

await writeCloudMCPCatalog(await resolveWorkspaceRoot(process.cwd()))
