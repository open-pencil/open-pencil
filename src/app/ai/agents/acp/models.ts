import type { ClientSideConnection, NewSessionResponse } from '@agentclientprotocol/sdk'

import type { ACPAgentDef, ModelOption } from '@open-pencil/core/constants'

/** The models an agent offers, by the ID a session sets them with, and the one it starts on. */
export interface AgentModels {
  options: ModelOption[]
  current: string
}

/** What a session response says about choosing its model; resuming answers the same. */
export type OfferedModels = Pick<NewSessionResponse, 'configOptions' | 'models'>

/** How the agent takes a model: through a session option, or through the session's own request. */
type ModelChoice = AgentModels & ({ via: 'option'; configId: string } | { via: 'session' })

function modelChoice({ configOptions, models }: OfferedModels): ModelChoice | null {
  // Agents tag their model selector with a category, or name it `model`.
  const option = configOptions?.find((entry) => entry.category === 'model' || entry.id === 'model')
  if (option) {
    return {
      via: 'option',
      configId: option.id,
      current: option.currentValue,
      options: option.options
        .flatMap((entry) => ('options' in entry ? entry.options : [entry]))
        .map(({ value, name }) => ({ id: value, name }))
    }
  }
  if (!models) return null
  return {
    via: 'session',
    current: models.currentModelId,
    options: models.availableModels.map(({ modelId, name }) => ({ id: modelId, name }))
  }
}

/** The models an agent lets a client choose from, or null when it offers no choice. */
export function agentModels(offered: OfferedModels): AgentModels | null {
  const choice = modelChoice(offered)
  return choice && { options: choice.options, current: choice.current }
}

/**
 * Puts a session on `modelID`. The agent itself refuses an ID it does not know; an agent that
 * offers no choice of model cannot honour the request, which is said instead of ignored.
 */
export async function chooseAgentModel(
  connection: Pick<ClientSideConnection, 'setSessionConfigOption' | 'unstable_setSessionModel'>,
  agent: ACPAgentDef,
  sessionId: string,
  offered: OfferedModels,
  modelID: string
): Promise<void> {
  const choice = modelChoice(offered)
  if (!choice) throw new Error(`${agent.name} does not let OpenPencil choose its model.`)
  if (choice.current === modelID) return
  if (choice.via === 'option') {
    await connection.setSessionConfigOption({
      sessionId,
      configId: choice.configId,
      value: modelID
    })
  } else {
    await connection.unstable_setSessionModel({ sessionId, modelId: modelID })
  }
}
