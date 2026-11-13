import {
  methods,
  type ClientContext,
  type SessionConfigOption,
  type SessionConfigOptionCategory,
  type SetSessionConfigOptionRequest,
  type SetSessionConfigOptionResponse
} from '@agentclientprotocol/sdk/unstable'

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
    current: option.currentValue,
    values: option.options
      .flatMap((entry) => ('options' in entry ? entry.options : [entry]))
      .map(({ value, name }) => ({ id: value, name }))
  }
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
 * refuses a value it does not know. False when the session offers no such option, so the caller
 * decides whether going on without it is right.
 */
export async function chooseSessionOption(
  requests: SessionOptionRequests,
  sessionId: string,
  offered: OfferedSessionOptions,
  category: SessionConfigOptionCategory,
  value: string
): Promise<boolean> {
  const choice = sessionChoice(offered, category)
  if (!choice) return false
  if (choice.current !== value) {
    await requests.setConfigOption({ sessionId, configId: choice.configId, value })
  }
  return true
}
