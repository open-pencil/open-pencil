import * as v from 'valibot'

import { behaviourSpecSchema } from '@open-pencil/scene-graph'

import { OpenPencilAPI } from '#core/openpencil-api'
import { defineTool } from '#core/tools/schema'

const failure = (error: unknown) => ({
  error: error instanceof Error ? error.message : String(error)
})

export const setBehaviour = defineTool({
  name: 'set_behaviour',
  description:
    'Make a main component or component set behave as a Reka UI control in preview and code, ' +
    'naming its own properties and slots: e.g. { kind: "switch", values: { value: "State" }, ' +
    'parts: { thumb: "Thumb" }, states: "Interaction" }. Variant on/off values are guessed from ' +
    'names like On and Off unless given as { property, on, off }. Pass null to remove it. ' +
    'Returns the behaviour and the required values and parts still missing; get_behaviour lists ' +
    'every kind with its values and parts.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.object({
    id: v.pipe(
      v.string(),
      v.description('Main component or component set ID; a variant uses its set')
    ),
    behaviour: v.pipe(
      v.nullable(behaviourSpecSchema),
      v.description('The behaviour by property and slot names, or null to remove it')
    )
  }),
  execute: (figma, { id, behaviour }) => {
    try {
      const openpencil = new OpenPencilAPI(figma)
      if (behaviour) return openpencil.setBehaviour(id, behaviour).toJSON()
      openpencil.getBehaviour(id)?.remove()
      return { ok: true }
    } catch (error) {
      return failure(error)
    }
  }
})

export const createSlot = defineTool({
  name: 'create_slot',
  description:
    'Make a frame inside a main component a slot, as Create slot does: instances can then hold ' +
    'their own content in it, and a behaviour can bind it as a part. Returns the slot name.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.object({
    id: v.pipe(v.string(), v.description('Frame ID inside a main component'))
  }),
  execute: (figma, { id }) => {
    try {
      return { slot: new OpenPencilAPI(figma).createSlot(id) }
    } catch (error) {
      return failure(error)
    }
  }
})

export const getBehaviour = defineTool({
  name: 'get_behaviour',
  description:
    'Read the behaviour of a main component, component set, or variant by property and slot ' +
    'names, with the required values and parts still missing. Without an ID, list every ' +
    'behaviour kind with the values and parts it binds.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.object({
    id: v.optional(v.pipe(v.string(), v.description('Component, set, or variant ID')))
  }),
  execute: (figma, { id }) => {
    const openpencil = new OpenPencilAPI(figma)
    if (!id) return { kinds: openpencil.behaviourKinds }
    try {
      return openpencil.getBehaviour(id)?.toJSON() ?? { behaviour: null }
    } catch (error) {
      return failure(error)
    }
  }
})
