import type { AvailableCommand } from '@agentclientprotocol/sdk'
import { shallowRef } from 'vue'

/** A slash command an ACP agent offers, such as Claude Code's skills and commands. */
export interface AgentCommand {
  name: string
  description: string
  /** What to type after the command, when it takes input. */
  hint: string | null
}

/**
 * The commands each agent last announced, by agent ID. Agents send their list once a session
 * starts and again when it changes; the composer offers them to run by name.
 */
export const agentCommands = shallowRef<Readonly<Record<string, readonly AgentCommand[]>>>({})

export function setAgentCommands(agentId: string, commands: readonly AvailableCommand[]): void {
  agentCommands.value = {
    ...agentCommands.value,
    [agentId]: commands.map((command) => ({
      name: command.name,
      description: command.description,
      hint: command.input?.hint ?? null
    }))
  }
}

export function agentCommand(name: string): string {
  return `/${name} `
}
