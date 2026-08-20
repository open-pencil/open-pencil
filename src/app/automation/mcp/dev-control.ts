export const DEV_MCP_RESTART_PATH = '/__openpencil/mcp/restart'

export interface DevMCPConfiguration {
  authenticationEnabled: boolean
  rootDirectory: string
  disabledTools: string
}

export function isDevMCPConfiguration(value: unknown): value is DevMCPConfiguration {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const authenticationEnabled = Reflect.get(value, 'authenticationEnabled')
  const rootDirectory = Reflect.get(value, 'rootDirectory')
  const disabledTools = Reflect.get(value, 'disabledTools')
  return (
    typeof authenticationEnabled === 'boolean' &&
    typeof rootDirectory === 'string' &&
    rootDirectory.length <= 4_096 &&
    typeof disabledTools === 'string' &&
    disabledTools.length <= 65_536
  )
}
