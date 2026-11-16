import { OPEN_PENCIL_MCP_SERVER } from '@open-pencil/core/constants'
import { createToolDescriptors } from '@open-pencil/mcp/tools'

/**
 * Oh My Pi mounts an MCP tool as the device `xd://mcp__<server>_<tool>`, with the server and the
 * tool lowercased, any run of characters but letters, digits, and `_` made one `_`, and the ends
 * trimmed. Both names may hold `_`, so a device name does not tell its server from its tool.
 */
function deviceName(name: string): string {
  return name
    .toLowerCase()
    .replaceAll(/[^a-z0-9_]+/g, '_')
    .replaceAll(/_+/g, '_')
    .replaceAll(/^_+|_+$/g, '')
}

const OWN_SERVER = deviceName(OPEN_PENCIL_MCP_SERVER)
const OWN_TOOLS = createToolDescriptors(true).map((tool) => tool.name)
const OWN_DEVICES = new Map(
  OWN_TOOLS.map((tool) => [`xd://mcp__${OWN_SERVER}_${deviceName(tool)}`, tool])
)

/** The OpenPencil tool a device path names, or null for any other path. */
export function ompOwnTool(path: string): string | null {
  return OWN_DEVICES.get(path) ?? null
}

/**
 * Whether another server's tool could mount at one of OpenPencil's devices. The path alone cannot
 * tell it from OpenPencil's own call, so the app keeps such a server out of Oh My Pi's session.
 */
export function shadowsOwnTools(serverName: string): boolean {
  const server = `${deviceName(serverName)}_`
  return OWN_TOOLS.some((tool) => `${OWN_SERVER}_${deviceName(tool)}`.startsWith(server))
}
