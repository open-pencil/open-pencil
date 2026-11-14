import * as v from 'valibot'

import type { ACPAgentDef } from '@open-pencil/core/constants'

import { readCacheJSON, writeCacheJSON } from '@/app/cache'

import type { AgentOffer } from './oneoff'

const offerSchema = v.object({
  models: v.array(v.object({ id: v.string(), name: v.string() })),
  imageInput: v.boolean()
}) satisfies v.GenericSchema<unknown, AgentOffer>

/** How long a remembered offer stands in for starting the agent, as a provider's catalog does. */
const AGENT_OFFER_MAX_AGE_MS = 24 * 60 * 60 * 1000

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

/** Keeps an agent's offer for the next time a profile of it opens; a failed write is skipped. */
export async function rememberAgentOffer(agent: ACPAgentDef, offer: AgentOffer): Promise<void> {
  await writeCacheJSON(offerKey(agent), offer).catch(() => undefined)
}
