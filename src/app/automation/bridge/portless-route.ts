export interface DevAutomationRoute {
  browserURL: string
  corsOrigin: string
  portlessServiceName: string | null
  runtimeId: string
}

const APP_NAME = 'open-pencil'
const MCP_SERVICE_NAME = `mcp.${APP_NAME}`

export function devAutomationRoute(
  portlessURL: string | undefined,
  fallbackPort: number
): DevAutomationRoute {
  if (!portlessURL) {
    return {
      browserURL: `ws://127.0.0.1:${fallbackPort}`,
      corsOrigin: 'http://localhost:1420',
      portlessServiceName: null,
      runtimeId: `localhost-${fallbackPort}`
    }
  }

  const appURL = new URL(portlessURL)
  const marker = `${APP_NAME}.`
  const markerIndex = appURL.hostname.lastIndexOf(marker)
  if (markerIndex === -1) throw new Error(`Unexpected OpenPencil Portless URL: ${portlessURL}`)
  const prefix = appURL.hostname.slice(0, markerIndex)
  const suffix = appURL.hostname.slice(markerIndex + APP_NAME.length)
  const mcpHostname = `${prefix}${MCP_SERVICE_NAME}${suffix}`
  return {
    browserURL: `wss://${mcpHostname}`,
    corsOrigin: appURL.origin,
    portlessServiceName: MCP_SERVICE_NAME,
    runtimeId: mcpHostname
  }
}
