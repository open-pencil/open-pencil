import * as v from 'valibot'

import type { RemotePeer } from '@/app/collab/types'
import { PEER_COLORS } from '@/constants'

import { AGENT_KINDS, AGENT_STATUSES } from './types'

/** Bounds on what a peer can publish, so a broken or hostile peer cannot flood rendering. */
export const MAX_AGENTS_PER_PEER = 16
const MAX_SELECTION = 256
/** Outlines an agent draws around JSX it is still streaming. */
export const MAX_OUTLINE = 32
export const MAX_NAME_LENGTH = 40
const MAX_ID = 64

const finite = v.pipe(v.number(), v.finite())
const unit = v.pipe(finite, v.minValue(0), v.maxValue(1))
const id = v.pipe(v.string(), v.maxLength(MAX_ID))
const name = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(MAX_NAME_LENGTH))
/** Optional fields fall back to absent instead of discarding the whole peer. */
const lenient = <T extends v.GenericSchema>(schema: T) => v.fallback(v.optional(schema), undefined)

const color = v.object({ r: unit, g: unit, b: unit, a: v.fallback(unit, 1) })
const point = v.object({ x: finite, y: finite, pageId: id })
const personPoint = v.object({
  ...point.entries,
  zoom: lenient(v.pipe(finite, v.minValue(0.02), v.maxValue(256)))
})
const selection = v.pipe(v.array(id), v.maxLength(MAX_SELECTION))
const extent = v.pipe(finite, v.minValue(0))
const outline = v.pipe(
  v.array(v.object({ x: finite, y: finite, width: extent, height: extent })),
  v.maxLength(MAX_OUTLINE)
)

const agent = v.object({
  id,
  name,
  kind: v.picklist(AGENT_KINDS),
  model: lenient(v.pipe(v.string(), v.maxLength(MAX_NAME_LENGTH))),
  status: v.picklist(AGENT_STATUSES),
  pageId: lenient(id),
  cursor: lenient(point),
  selection: lenient(selection),
  outline: lenient(outline)
})

const peerState = v.object({
  user: v.object({ name: lenient(name), color: lenient(color) }),
  cursor: lenient(personPoint),
  selection: lenient(selection),
  treeFormat: lenient(v.pipe(v.number(), v.integer(), v.minValue(1))),
  hasFile: lenient(v.boolean()),
  agents: v.fallback(
    v.optional(
      v.pipe(v.array(v.fallback(v.nullable(agent), null)), v.maxLength(MAX_AGENTS_PER_PEER))
    ),
    []
  )
})

/** Validate a peer's awareness state; awareness comes from other people's browsers. */
export function parsePeer(clientId: number, state: unknown): RemotePeer | null {
  const result = v.safeParse(peerState, state)
  if (!result.success) return null
  const { user, cursor, selection: selected, agents, treeFormat, hasFile } = result.output
  return {
    clientId,
    name: user.name ?? 'Anonymous',
    color: user.color ?? PEER_COLORS[clientId % PEER_COLORS.length],
    cursor,
    selection: selected,
    agents: (agents ?? []).flatMap((entry) => (entry ? [entry] : [])),
    treeFormat,
    hasFile: hasFile === true
  }
}
