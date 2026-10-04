import { defineCommand } from 'citty'
import { flattenObject } from 'es-toolkit'

import { rpc } from '#cli/app/client'
import { bold, kv, ok, printError } from '#cli/format'

type Settings = Record<string, unknown>

const json = { type: 'boolean', description: 'Output as JSON' } as const

function readPath(settings: Settings, key: string): unknown {
  let value: unknown = settings
  for (const part of key.split('.')) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, part)) {
      throw new Error(`Unknown setting "${key}"`)
    }
    value = (value as Settings)[part]
  }
  return value
}

/** `editing.snapping.objects` + `false` → `{ editing: { snapping: { objects: false } } }`. */
function patchFor(key: string, value: unknown): Settings {
  return key
    .split('.')
    .reduceRight<unknown>((inner, part) => ({ [part]: inner }), value) as Settings
}

// Values are JSON when they parse (`false`, `50`, `"auto"`), plain strings otherwise (`light`).
function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function printSettings(settings: Settings): void {
  for (const [key, value] of Object.entries(flattenObject(settings))) {
    console.log(kv(key, value))
  }
}

const get = defineCommand({
  meta: { description: 'Show editor settings, or one setting by dotted key' },
  args: {
    key: { type: 'positional', description: 'Dotted key, e.g. appearance.theme', required: false },
    json
  },
  async run({ args }) {
    try {
      const { settings } = await rpc<{ settings: Settings }>('get_settings')
      const value = args.key ? readPath(settings, args.key) : settings
      if (args.json) {
        console.log(JSON.stringify(value, null, 2))
      } else if (value && typeof value === 'object') {
        printSettings(value as Settings)
      } else {
        console.log(String(value))
      }
    } catch (error) {
      printError(error)
      process.exit(1)
    }
  }
})

const set = defineCommand({
  meta: { description: 'Change one editor setting by dotted key' },
  args: {
    key: {
      type: 'positional',
      description: 'Dotted key, e.g. editing.snapping.pixelGrid',
      required: true
    },
    value: {
      type: 'positional',
      description: 'New value, e.g. false, 100, or light',
      required: true
    },
    json
  },
  async run({ args }) {
    try {
      const { settings } = await rpc<{ settings: Settings }>('update_settings', {
        settings: patchFor(args.key, parseValue(args.value))
      })
      if (args.json) {
        console.log(JSON.stringify(settings, null, 2))
        return
      }
      console.log(ok(`${bold(args.key)} = ${JSON.stringify(readPath(settings, args.key))}`))
    } catch (error) {
      printError(error)
      process.exit(1)
    }
  }
})

export default defineCommand({
  meta: { description: 'Read and change editor settings in the running app' },
  subCommands: { get, set }
})
