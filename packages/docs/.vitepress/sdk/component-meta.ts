import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createChecker } from 'vue-component-meta'

export interface SdkComponentPropMeta {
  name: string
  type: string
  description: string
  required: boolean
  default?: string
}

export interface SdkComponentEventMeta {
  name: string
  payload: string
  description: string
}

export interface SdkComponentSlotMeta {
  name: string
  props: string
  description: string
}

export interface SdkComponentExposeMeta {
  name: string
  type: string
  description: string
}

export interface SdkComponentMeta {
  name: string
  source: string
  props: SdkComponentPropMeta[]
  events: SdkComponentEventMeta[]
  slots: SdkComponentSlotMeta[]
  exposed: SdkComponentExposeMeta[]
}

const repoRoot = fileURLToPath(new URL('../../../..', import.meta.url))
const checker = createChecker(resolve(repoRoot, 'packages/vue/tsconfig.json'), { schema: false })

export function readComponentMeta(source: string): SdkComponentMeta {
  const absoluteSource = resolve(repoRoot, source)
  const meta = checker.getComponentMeta(absoluteSource)

  return {
    name: meta.name ?? source.split('/').at(-1)?.replace(/\.vue$/, '') ?? source,
    source,
    props: meta.props
      .filter((prop) => !prop.global)
      .map((prop) => ({
        name: prop.name,
        type: prop.type,
        description: prop.description,
        required: prop.required,
        default: prop.default
      })),
    events: meta.events.map((event) => ({
      name: event.name,
      payload: event.type,
      description: event.description
    })),
    slots: meta.slots.map((slot) => ({
      name: slot.name,
      props: slot.type,
      description: slot.description
    })),
    exposed: meta.exposed.map((entry) => ({
      name: entry.name,
      type: entry.type,
      description: entry.description
    }))
  }
}
