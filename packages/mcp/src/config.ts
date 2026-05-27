import fs from 'node:fs'
import path from 'node:path'

export interface McpConfigFile {
  httpPort?: number
  authToken?: string | null
  corsOrigin?: string | null
  mcpRoot?: string | null
  enableEval?: boolean
}

export const MCP_CONFIG_FILE_NAME = 'mcp.config.json'

export function resolveMcpConfigPath(cwd: string, explicitPath?: string | null): string {
  const trimmed = explicitPath?.trim()
  if (trimmed) return path.isAbsolute(trimmed) ? trimmed : path.join(cwd, trimmed)
  return path.join(cwd, MCP_CONFIG_FILE_NAME)
}

export function loadMcpConfigFile(configPath: string): McpConfigFile | null {
  if (!fs.existsSync(configPath)) return null
  const raw = fs.readFileSync(configPath, 'utf8')
  const parsed = JSON.parse(raw) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`MCP config at ${configPath} must be a JSON object.`)
  }
  return parsed as McpConfigFile
}