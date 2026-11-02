import dedent from 'dedent'

import { APP_VERSION } from '@/app/runtime/version'

import { MCP_INSTALL_COMMAND, type MCPFailure } from './failure'

/** Reasons the person can fix by installing the MCP server at this app's version. */
export function needsMCPInstall(failure: MCPFailure): boolean {
  return failure.code === 'not-installed' || failure.code === 'outdated'
}

/**
 * Markdown to paste into the agent the person connects over MCP, asking it to install the
 * server that matches this app when Lawha cannot do it with one click. Written for the
 * agent, so it stays in English.
 */
export function mcpServerSetupPrompt(
  failure: MCPFailure,
  installCommand: string = MCP_INSTALL_COMMAND
): string {
  const found =
    failure.code === 'outdated'
      ? `Lawha found version ${failure.detail ?? 'an older version'} installed, which does not match the app.`
      : 'Lawha could not find the `lawha-mcp-http` command.'
  return dedent`
    Help me set up Lawha's MCP server so you can work on my designs in Lawha, an open-source design editor. The server is a separate npm package, kept out of the app to keep its download small, and its version must match the app. ${found}

    Please do this for me:

    1. Install the version that matches my app: \`${installCommand}\`. If Node.js or npm is missing, tell me how to install it. If npm fails with a permission error (EACCES), set up a global npm folder in my home directory (for example \`npm config set prefix ~/.npm-global\` and add \`~/.npm-global/bin\` to my PATH) and install again; use sudo only if I agree.
    2. Confirm that \`lawha-mcp-http --version\` prints ${APP_VERSION}. If the command is not found, check that the global npm or Bun folder is on my PATH and tell me how to add it.

    Then tell me what you did. I will press "Restart MCP server" in Lawha's Settings → MCP afterwards.
  `
}
