import { exposeAutomationRequests } from '@/app/browser-bridge'

import { makeFigmaFromStore } from './figma-factory'
import { createAutomationCommandHandlers } from './handlers'

/** Lets browser tests send MCP requests through the same handler the bridge uses. */
export function exposeAutomationTestRequests() {
  exposeAutomationRequests(createAutomationCommandHandlers(makeFigmaFromStore).handleRequest)
}
