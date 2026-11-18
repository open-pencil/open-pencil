import * as v from 'valibot'
import { shallowRef } from 'vue'

import type { ACPAgentDef, ACPAgentID } from '@open-pencil/core/constants'
import { DAY_MS } from '@open-pencil/scene-graph/timing'

import { readCacheJSON, writeCacheJSON } from '@/app/cache'

import type { AgentOffer } from './oneoff'
import type { AgentModelChoices } from './options'

const valueSchema = v.object({ id: v.string(), name: v.string() })
const choiceSchema = v.object({
  name: v.string(),
  current: v.string(),
  values: v.array(
    v.object({ id: v.string(), name: v.string(), description: v.optional(v.string()) })
  )
})
const offerSchema = v.object({
  models: v.array(valueSchema),
  imageInput: v.boolean(),
  choices: v.record(
    v.string(),
    v.partial(
      v.object({
        thought_level: choiceSchema,
        mode: choiceSchema,
        collaboration_mode: choiceSchema
      })
    )
  )
}) satisfies v.GenericSchema<unknown, AgentOffer>

/** How long a remembered offer stands in for starting the agent, as a provider's catalog does. */
const AGENT_OFFER_MAX_AGE_MS = DAY_MS

function offerKey(agent: ACPAgentDef): string {
  return `agents/${agent.id}/offer`
}

/** What an agent offered the last time it was asked. */
export interface RememberedAgentOffer {
  offer: AgentOffer
  /** Recent enough that the agent need not be started to ask again. */
  fresh: boolean
}

/**
 * The offer an agent gave last time, so a profile shows its models at once instead of starting
 * the agent each time it opens. An older one is still shown while the agent is asked again.
 */
export async function rememberedAgentOffer(
  agent: ACPAgentDef
): Promise<RememberedAgentOffer | null> {
  const key = offerKey(agent)
  const fresh = await readCacheJSON(key, offerSchema, AGENT_OFFER_MAX_AGE_MS).catch(() => null)
  if (fresh) return { offer: fresh, fresh: true }
  const stale = await readCacheJSON(key, offerSchema).catch(() => null)
  return stale && { offer: stale, fresh: false }
}

/** The offers read in this window, by agent, so what shows a model can name it without waiting. */
const known = shallowRef<ReadonlyMap<ACPAgentID, AgentOffer>>(new Map())
/** The agents whose remembered offer was already asked for. */
const looked = new Set<ACPAgentID>()

function note(agent: ACPAgentDef, offer: AgentOffer): void {
  known.value = new Map(known.value).set(agent.id, offer)
}

/** The offer an agent gave last, loading the remembered one the first time it is asked for. */
function knownOffer(agent: ACPAgentDef): AgentOffer | null {
  if (!known.value.has(agent.id) && !looked.has(agent.id)) {
    looked.add(agent.id)
    void rememberedAgentOffer(agent).then((remembered) => {
      if (remembered && !known.value.has(agent.id)) note(agent, remembered.offer)
      return undefined
    })
  }
  return known.value.get(agent.id) ?? null
}

/**
 * The name an agent gives one of its models, such as "Opus 5.5" for `opus`, from the offer it
 * gave last; null until that is read, or for a model it does not list. Reactive: a name appears
 * once the remembered offer has loaded.
 */
export function agentModelName(agent: ACPAgentDef, modelID: string): string | null {
  return knownOffer(agent)?.models.find((model) => model.id === modelID)?.name ?? null
}

/**
 * What one of an agent's models offered to choose besides it when a profile chose it, `''` being
 * the agent's own model; null until read. Reactive, as `agentModelName` is.
 */
export function agentModelChoicesOffered(
  agent: ACPAgentDef,
  modelID: string
): AgentModelChoices | null {
  return knownOffer(agent)?.choices[modelID] ?? null
}

/** Keeps an agent's offer for the next time a profile of it opens; a failed write is skipped. */
export async function rememberAgentOffer(agent: ACPAgentDef, offer: AgentOffer): Promise<void> {
  note(agent, offer)
  await writeCacheJSON(offerKey(agent), offer).catch(() => undefined)
}
