import * as v from 'valibot'

import { MAX_PRESENCE_NAME_LENGTH } from '@open-pencil/cloud/contract'

import type { RemotePeer } from '@/app/collab/types'
import { PEER_COLORS } from '@/constants'

import { AGENT_KINDS, AGENT_STATUSES } from './types'

/** Bounds on what a peer can publish, so a broken or hostile peer cannot flood rendering. */
export const MAX_AGENTS_PER_PEER = 16
const MAX_SELECTION = 256
/** Outlines an agent draws around JSX it is still streaming. */
export const MAX_OUTLINE = 32
export const MAX_NAME_LENGTH = MAX_PRESENCE_NAME_LENGTH
const MAX_ID = 64

const finiteSchema = v.pipe(v.number(), v.finite())
const unitSchema = v.pipe(finiteSchema, v.minValue(0), v.maxValue(1))
const idSchema = v.pipe(v.string(), v.maxLength(MAX_ID))
const nameSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(MAX_NAME_LENGTH))
/** Optional fields fall back to absent instead of discarding the whole peer. */
const lenient = <T extends v.GenericSchema>(schema: T) => v.fallback(v.optional(schema), undefined)

const colorSchema = v.object({
  r: unitSchema,
  g: unitSchema,
  b: unitSchema,
  a: v.fallback(unitSchema, 1)
})
const pointSchema = v.object({ x: finiteSchema, y: finiteSchema, pageId: idSchema })
const personPointSchema = v.object({
  ...pointSchema.entries,
  zoom: lenient(v.pipe(finiteSchema, v.minValue(0.02), v.maxValue(256)))
})
const selectionSchema = v.pipe(v.array(idSchema), v.maxLength(MAX_SELECTION))
const extentSchema = v.pipe(finiteSchema, v.minValue(0))
const outlineSchema = v.pipe(
  v.array(
    v.object({ x: finiteSchema, y: finiteSchema, width: extentSchema, height: extentSchema })
  ),
  v.maxLength(MAX_OUTLINE)
)

const agentSchema = v.object({
  id: idSchema,
  name: nameSchema,
  kind: v.picklist(AGENT_KINDS),
  model: lenient(v.pipe(v.string(), v.maxLength(MAX_NAME_LENGTH))),
  status: v.picklist(AGENT_STATUSES),
  pageId: lenient(idSchema),
  cursor: lenient(pointSchema),
  selection: lenient(selectionSchema),
  outline: lenient(outlineSchema)
})

const peerStateSchema = v.object({
  user: v.object({ name: lenient(nameSchema), color: lenient(colorSchema) }),
  cursor: lenient(personPointSchema),
  selection: lenient(selectionSchema),
  treeFormat: lenient(v.pipe(v.number(), v.integer(), v.minValue(1))),
  hasFile: lenient(v.boolean()),
  voice: lenient(v.object({ muted: v.boolean() })),
  agents: v.fallback(
    v.optional(
      v.pipe(v.array(v.fallback(v.nullable(agentSchema), null)), v.maxLength(MAX_AGENTS_PER_PEER))
    ),
    []
  )
})

/** Validate a peer's awareness state; awareness comes from other people's browsers. */
export function parsePeer(clientId: number, state: unknown): RemotePeer | null {
  const result = v.safeParse(peerStateSchema, state)
  if (!result.success) return null
  const { user, cursor, selection: selected, agents, treeFormat, hasFile, voice } = result.output
  return {
    clientId,
    name: user.name ?? 'Anonymous',
    color: user.color ?? PEER_COLORS[clientId % PEER_COLORS.length],
    cursor,
    selection: selected,
    agents: (agents ?? []).flatMap((entry) => (entry ? [entry] : [])),
    treeFormat,
    hasFile: hasFile === true,
    voice
  }
}
