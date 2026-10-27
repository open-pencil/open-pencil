import dedent from 'dedent'

import { ACP_AGENTS, type ACPAgentDef, type ACPAgentID } from '@open-pencil/core/constants'

import { MCP_INSTALL_COMMAND } from '@/app/automation/mcp/failure'
import { CODING_AGENTS_GUIDE_URL } from '@/constants'

import { agentCommandNames } from './discovery'

const SIGN_IN: Record<Exclude<ACPAgentID, 'cursor'>, string> = {
  'claude-code':
    'Make sure I am signed in to Claude Code: run `claude` and use `/login` if it asks me to sign in.',
  codex: 'Make sure I am signed in to Codex: run `codex login` if I am not.',
  'gemini-cli': 'Make sure I am signed in to Gemini CLI: run `gemini` and choose a sign-in method.'
}

/** One command keeps the original sentence; several name every alias. */
function absentOnPath(names: string[]): string {
  const [first, second, ...rest] = names
  if (!first) return 'If the agent is not on my PATH'
  if (!second) return `If \`${first}\` is not on my PATH`
  if (rest.length === 0) return `If neither \`${first}\` nor \`${second}\` is on my PATH`
  const quoted = names.map((name) => `\`${name}\``)
  const last = quoted.at(-1)
  if (!last) return 'If the agent is not on my PATH'
  return `If none of ${quoted.slice(0, -1).join(', ')}, or ${last} is on my PATH`
}

function installInstruction(agent: ACPAgentDef): string {
  const absent = absentOnPath(agentCommandNames(agent))
  if (agent.installCommand) return `${absent}, install it: \`${agent.installCommand}\``
  const from = agent.setupURL ? ` from ${agent.setupURL}` : ''
  return `${absent}, install ${agent.name}${from}.`
}

function confirmCommands(names: string[]): string {
  const [command, ...aliases] = names
  if (!command) {
    return 'Confirm `openpencil-mcp-http` is found (`where` on Windows). If a global npm folder is missing from my PATH, tell me how to add it.'
  }
  const found =
    aliases.length === 0
      ? `with \`which ${command}\` and \`which openpencil-mcp-http\``
      : `with ${names.map((name) => `\`which ${name}\``).join(' or ')} and \`which openpencil-mcp-http\``
  const both = aliases.length === 0 ? 'both commands are' : 'the commands are'
  return `Confirm ${both} found, for example ${found} (\`where\` on Windows). If a global npm folder is missing from my PATH, tell me how to add it.`
}

function signInInstruction(agent: ACPAgentDef): string {
  if (agent.id !== 'cursor') return SIGN_IN[agent.id]
  const logins = agentCommandNames(agent)
    .map((name) => `\`${name} login\``)
    .join(' or ')
  return `Save a personal user API key from https://cursor.com/dashboard in OpenPencil's Cursor model settings. Do not use a team Admin key. If no key is saved, ${logins} still works.`
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
  const names = agentCommandNames(agent)
  return dedent`
    Help me connect ${agent.name} to OpenPencil, an open-source design editor. OpenPencil starts ${agent.name} through the Agent Client Protocol and gives it canvas tools through OpenPencil's local MCP server, so both need to be installed on this computer.

    Please do this for me:

    1. ${installInstruction(agent)}
    2. If \`openpencil-mcp-http\` is not on my PATH, install OpenPencil's MCP server: \`${MCP_INSTALL_COMMAND}\`
    3. If npm fails with a permission error (EACCES), set up a global npm folder in my home directory (for example \`npm config set prefix ~/.npm-global\` and add \`~/.npm-global/bin\` to my PATH) and install again; use sudo only if I agree.
    4. ${confirmCommands(names)}
    5. ${signInInstruction(agent)}

    Then tell me what you installed and anything I still need to do myself. I will press "Check again" in OpenPencil's AI setup afterwards.

    Setup guide: ${codingAgentGuideURL(agentID)}
  `
}
