import { randomUUID } from 'node:crypto'
import process from 'node:process'

import { automationPlugin } from '../src/app/automation/bridge/vite-plugin'

const devAutomationAuthToken = process.env.INKLY_DEV_TOKEN ?? randomUUID()

export function localAutomationToken(command: string): string | null {
  return command === 'serve' ? devAutomationAuthToken : null
}

export function automationCorsOrigin(host: string | undefined): string {
  return host ? `http://${host}:1420` : 'http://localhost:1420'
}

export function inklyAutomationPlugin(command: string, host: string | undefined) {
  return automationPlugin(localAutomationToken(command), automationCorsOrigin(host))
}
