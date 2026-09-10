import { randomUUID } from 'node:crypto'
import process from 'node:process'

import { AUTOMATION_HTTP_PORT } from '@open-pencil/core/constants'

import { devAutomationRoute } from '../src/app/automation/bridge/portless-route'
import { automationPlugin } from '../src/app/automation/bridge/vite-plugin'

const devAutomationAuthToken = process.env.OPENPENCIL_DEV_TOKEN ?? randomUUID()

export function localAutomationToken(command: string): string | null {
  return command === 'serve' ? devAutomationAuthToken : null
}

export function automationCORSOrigin(host: string | undefined): string {
  return host ? `http://${host}:1420` : 'http://localhost:1420'
}

export function localAutomationRoute(host: string | undefined) {
  const port = Number(process.env.OPENPENCIL_DEV_MCP_PORT ?? AUTOMATION_HTTP_PORT)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('OPENPENCIL_DEV_MCP_PORT must be an integer between 1024 and 65535')
  }
  const origin = process.env.OPENPENCIL_DEV_ORIGIN ?? automationCORSOrigin(host)
  const url = new URL(origin)
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
    throw new Error('OPENPENCIL_DEV_ORIGIN must be an HTTP(S) origin')
  }
  return { ...devAutomationRoute(process.env.PORTLESS_URL, port, origin), httpPort: port }
}

export function openPencilAutomationPlugin(command: string, host: string | undefined) {
  return automationPlugin(localAutomationToken(command), localAutomationRoute(host))
}
