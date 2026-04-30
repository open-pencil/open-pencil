import { randomUUID } from 'crypto'

import { automationPlugin } from '../src/app/automation/bridge/vite-plugin'

const devAutomationAuthToken = randomUUID()

export function localAutomationToken(command: string): string | null {
  return command === 'serve' ? devAutomationAuthToken : null
}

export function automationCorsOrigin(host: string | undefined): string {
  return host ? `http://${host}:1420` : 'http://localhost:1420'
}

export function openPencilAutomationPlugin(command: string, host: string | undefined) {
  return automationPlugin(localAutomationToken(command), automationCorsOrigin(host))
}
