export const DEV_MCP_RESTART_PATH = '/__openpencil/mcp/restart'

const MAX_ROOT_DIRECTORY_LENGTH = 4_096
const MAX_DISABLED_TOOL_COUNT = 512
const MAX_DISABLED_TOOL_NAME_LENGTH = 128
const MAX_DISABLED_TOOLS_LENGTH = 65_536
const TOOL_NAME_PATTERN = /^[a-z0-9_:-]+$/

export interface DevMCPConfiguration {
  authenticationEnabled: boolean
  rootDirectory: string
  disabledTools: string[]
}

function parseDisabledTools(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_DISABLED_TOOL_COUNT) return null
  const disabledTools = new Set<string>()
  let encodedLength = 0
  for (const candidate of value) {
    if (typeof candidate !== 'string') return null
    const name = candidate.trim()
    if (!name || name.length > MAX_DISABLED_TOOL_NAME_LENGTH || !TOOL_NAME_PATTERN.test(name)) {
      return null
    }
    if (disabledTools.has(name)) continue
    encodedLength += name.length + (disabledTools.size > 0 ? 1 : 0)
    if (encodedLength > MAX_DISABLED_TOOLS_LENGTH) return null
    disabledTools.add(name)
  }
  return [...disabledTools]
}

export function parseDevMCPConfiguration(value: unknown): DevMCPConfiguration | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const authenticationEnabled = Reflect.get(value, 'authenticationEnabled')
  const rootDirectory = Reflect.get(value, 'rootDirectory')
  const disabledTools = parseDisabledTools(Reflect.get(value, 'disabledTools'))
  if (
    typeof authenticationEnabled !== 'boolean' ||
    typeof rootDirectory !== 'string' ||
    rootDirectory.length > MAX_ROOT_DIRECTORY_LENGTH ||
    !disabledTools
  ) {
    return null
  }
  return { authenticationEnabled, rootDirectory, disabledTools }
}
