import { pingSchema, usageEventSchema, type UsageEvent } from './schema'

export interface FieldDescription {
  name: string
  description: string
  /** Every value the field can take, or empty when it is free-form within its pattern. */
  values: readonly string[]
}

export interface UsageEventDescription {
  name: string
  description: string
  properties: FieldDescription[]
}

type EventProperties<E> = Exclude<keyof E, 'name' | 'timestamp'>

/** Plain-language meaning of each event and property; the privacy page renders these. */
const EVENT_DESCRIPTIONS: {
  [E in UsageEvent as E['name']]: {
    description: string
    properties: Record<EventProperties<E>, string>
  }
} = {
  app_opened: {
    description: 'OpenPencil started.',
    properties: { locale: 'The interface language.' }
  },
  document_opened: {
    description: 'A file was opened.',
    properties: { format: 'The file format.' }
  },
  document_exported: {
    description: 'A file was exported.',
    properties: { format: 'The export format.' }
  },
  ai_reply_finished: {
    description: 'The AI assistant finished a reply.',
    properties: { provider: 'Which kind of AI provider or agent answered.' }
  },
  usage_stats_enabled: {
    description: 'Usage stats were turned on, sent once with the agreement itself.',
    properties: {
      source: 'Where: right after the first-run welcome, on a later launch, or in Settings.'
    }
  }
}

type PingField = keyof typeof pingSchema.entries

const BUILD_FIELDS = [
  'version',
  'platform',
  'arch',
  'app',
  'browser'
] as const satisfies readonly PingField[]

const PING_DESCRIPTIONS: Record<PingField, string> = {
  version: 'The OpenPencil version, such as 0.16.0.',
  platform: 'The operating system family.',
  arch: 'The processor architecture, known on desktop only.',
  app: 'The desktop app or the web app.',
  browser: 'The browser family, for the web app.',
  usageStats: 'Whether this install shares usage stats, declined, or has not answered yet.'
}

function valuesOf(schema: unknown): readonly string[] {
  if (typeof schema !== 'object' || schema === null || !('options' in schema)) return []
  const { options } = schema
  return Array.isArray(options) ? options.filter((value) => typeof value === 'string') : []
}

function describeField(name: PingField): FieldDescription {
  return { name, description: PING_DESCRIPTIONS[name], values: valuesOf(pingSchema.entries[name]) }
}

/** The build fields every ping and every usage batch carries. */
export function describeBuildFields(): FieldDescription[] {
  return BUILD_FIELDS.map(describeField)
}

/** Every field of the daily ping: the build, and the install's usage stats answer. */
export function describePingFields(): FieldDescription[] {
  return [...describeBuildFields(), describeField('usageStats')]
}

/** Every usage event, its properties, and the values each property can take. */
export function describeUsageEvents(): UsageEventDescription[] {
  return usageEventSchema.options.map((option) => {
    const name = option.entries.name.literal
    const described: { description: string; properties: Record<string, string> } =
      EVENT_DESCRIPTIONS[name]
    return {
      name,
      description: described.description,
      properties: Object.entries(option.entries)
        .filter(([key]) => key !== 'name' && key !== 'timestamp')
        .map(([key, schema]) => ({
          name: key,
          description: described.properties[key] ?? '',
          values: valuesOf(schema)
        }))
    }
  })
}
