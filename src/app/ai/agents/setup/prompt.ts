import dedent from 'dedent'

import { ACP_AGENTS, type ACPAgentID } from '@open-pencil/core/constants'

import { MCP_INSTALL_COMMAND } from '@/app/automation/mcp/failure'
import { CODING_AGENTS_GUIDE_URL } from '@/constants'

const SIGN_IN: Record<ACPAgentID, string> = {
  'claude-code':
    'Make sure I am signed in to Claude Code: run `claude` and use `/login` if it asks me to sign in.',
  codex: 'Make sure I am signed in to Codex: run `codex login` if I am not.',
  'gemini-cli': 'Make sure I am signed in to Gemini CLI: run `gemini` and choose a sign-in method.'
}

export function codingAgentGuideURL(agentID: ACPAgentID): string {
  return `${CODING_AGENTS_GUIDE_URL}#${agentID}`
}

/**
 * Markdown to paste into a coding agent the person already uses, asking it to install what
 * OpenPencil needs to start it. Written for the agent, so it stays in English.
 */
export function codingAgentSetupPrompt(agentID: ACPAgentID): string {
  const agent = ACP_AGENTS.find((candidate) => candidate.id === agentID)
  if (!agent) return ''
  const install = agent.installCommand ?? `Install ${agent.name}`
  return dedent`
    Help me connect ${agent.name} to OpenPencil, an open-source design editor. OpenPencil starts ${agent.name} through the Agent Client Protocol and gives it canvas tools through OpenPencil's local MCP server, so both need to be installed on this computer.

    Please do this for me:

    1. If \`${agent.command}\` is not on my PATH, install it: \`${install}\`
    2. If \`openpencil-mcp-http\` is not on my PATH, install OpenPencil's MCP server: \`${MCP_INSTALL_COMMAND}\`
    3. If npm fails with a permission error (EACCES), set up a global npm folder in my home directory (for example \`npm config set prefix ~/.npm-global\` and add \`~/.npm-global/bin\` to my PATH) and install again; use sudo only if I agree.
    4. Confirm both commands are found, for example with \`which ${agent.command}\` and \`which openpencil-mcp-http\` (\`where\` on Windows). If a global npm folder is missing from my PATH, tell me how to add it.
    5. ${SIGN_IN[agentID]}

    Then tell me what you installed and anything I still need to do myself. I will press "Check again" in OpenPencil's AI setup afterwards.

    Setup guide: ${codingAgentGuideURL(agentID)}
  `
}
