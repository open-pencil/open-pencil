import {
  methods,
  type ClientContext,
  type SessionConfigOption,
  type SessionConfigOptionCategory,
  type SetSessionConfigOptionRequest,
  type SetSessionConfigOptionResponse
} from '@agentclientprotocol/sdk/unstable'
import { mapValues, omit } from 'es-toolkit'

import type { ModelOption } from '@open-pencil/core/constants'

/**
 * What an agent says about a session's options: when it opens or resumes one, and after each
 * change.
 */
export interface OfferedSessionOptions {
  configOptions?: SessionConfigOption[] | null
}

/** One value a session option can take, as a model option lists a model. */
export type SessionOptionValue = Pick<ModelOption, 'id' | 'name'>

/** A session option that takes one of several values, such as its model or its thinking effort. */
export interface SessionChoice {
  /** The option's ID, which each agent names itself: Codex's effort is `reasoning_effort`. */
  configId: string
  /** What the agent calls the option, such as "Mode". */
  name: string
  current: string
  values: SessionOptionValue[]
}

/**
 * The option of `category` a session offers. The category is what ACP fixes, and every agent
 * tags its model selector `model`; agents that group the values list them all.
 */
export function sessionChoice(
  { configOptions }: OfferedSessionOptions,
  category: SessionConfigOptionCategory
): SessionChoice | null {
  const option = configOptions?.find((entry) => entry.category === category)
  if (option?.type !== 'select') return null
  return {
    configId: option.id,
    name: option.name,
    current: option.currentValue,
    values: option.options
      .flatMap((entry) => ('options' in entry ? entry.options : [entry]))
      .map(({ value, name }) => ({ id: value, name }))
  }
}

/**
 * The session options a chat chooses besides the model, by ACP category: the thinking effort, the
 * mode, which sets what the agent may do without asking, and Codex's own collaboration mode,
 * which holds its Plan mode.
 */
export const AGENT_CHOICE_CATEGORIES = ['thought_level', 'mode', 'collaboration_mode'] as const

export type AgentChoiceCategory = (typeof AGENT_CHOICE_CATEGORIES)[number]

/** Values a chat names for a session's options, by the agent's own IDs; absent keeps the agent's. */
export type AgentChoices = Partial<Record<AgentChoiceCategory, string>>

/** One of a session's options as the chat offers it: its name, values, and current one. */
export type AgentChoice = Omit<SessionChoice, 'configId'>

/**
 * What a session offers to choose besides its model, on the model it is on: each model has its
 * own efforts. An option the session does not offer is absent.
 */
export type AgentModelChoices = Partial<Record<AgentChoiceCategory, AgentChoice>>

/** A session's options of each category, by their IDs; one it does not offer is absent. */
export type SessionChoices = Partial<Record<AgentChoiceCategory, SessionChoice>>

/** The session's options of each category, by their IDs; one it does not offer is absent. */
export function sessionChoices(offered: OfferedSessionOptions): SessionChoices {
  const choices: SessionChoices = {}
  for (const category of AGENT_CHOICE_CATEGORIES) {
    const choice = sessionChoice(offered, category)
    if (choice) choices[category] = choice
  }
  return choices
}

/**
 * The values a session moved to on its own between two reports, as when approving a plan leaves
 * Claude Code's Plan mode. An option whose change the chat still waits on (`current` empty) is
 * left out, since the chat asked for it.
 */
export function choicesMoved(before: SessionChoices, after: SessionChoices): AgentChoices {
  const moved: AgentChoices = {}
  for (const category of AGENT_CHOICE_CATEGORIES) {
    const was = before[category]?.current
    const now = after[category]?.current
    if (was && now && was !== now) moved[category] = now
  }
  return moved
}

/** A session's choices as the chat shows them, without the IDs only the agent needs. */
export function shownChoices(choices: SessionChoices): AgentModelChoices {
  return mapValues(choices, (choice) => choice && omit(choice, ['configId']))
}

/** What a session offers to choose besides its model, as the chat shows it. */
export function agentModelChoices(offered: OfferedSessionOptions): AgentModelChoices {
  return shownChoices(sessionChoices(offered))
}

/** The agent request that changes a session option, which tests make without a connection. */
export interface SessionOptionRequests {
  setConfigOption(params: SetSessionConfigOptionRequest): Promise<SetSessionConfigOptionResponse>
}

/** The session option request of a connection to the agent. */
export function sessionOptionRequests(agent: ClientContext): SessionOptionRequests {
  return {
    setConfigOption: (params) => agent.request(methods.agent.session.setConfigOption, params)
  }
}

/**
 * Sets the session's option of `category` to `value`, unless it already has it. The agent itself
 * refuses a value it does not know. The result is what the session offers afterwards, which can
 * change with the value: each model has its own efforts. Null when the session offers no such
 * option, so the caller decides whether going on without it is right.
 */
export async function chooseSessionOption(
  requests: SessionOptionRequests,
  sessionId: string,
  offered: OfferedSessionOptions,
  category: SessionConfigOptionCategory,
  value: string
): Promise<OfferedSessionOptions | null> {
  const choice = sessionChoice(offered, category)
  if (!choice) return null
  if (choice.current === value) return offered
  return requests.setConfigOption({ sessionId, configId: choice.configId, value })
}
