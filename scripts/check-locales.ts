#!/usr/bin/env bun
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const MESSAGES_PATH = 'packages/vue/src/i18n/messages.ts'
const LOCALES_DIR = 'packages/vue/src/locales'

const content = readFileSync(MESSAGES_PATH, 'utf-8')

const blocks = [...content.matchAll(/i18n\('(\w+)',\s*\{([\s\S]*?)\n\}\)/g)]
const enKeys = new Map<string, Set<string>>()
for (const [, ns, body] of blocks) {
  const keys = [...body.matchAll(/^\s+(\w+):/gm)].map((m) => m[1])
  enKeys.set(ns, new Set(keys))
}

const localeFiles = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'))
let hasErrors = false

for (const file of localeFiles) {
  const data = JSON.parse(readFileSync(join(LOCALES_DIR, file), 'utf-8'))
  const missing: string[] = []
  const extra: string[] = []

  for (const [ns, keys] of enKeys) {
    const localeNs = (data[ns] ?? {}) as Record<string, unknown>
    for (const key of keys) {
      if (!(key in localeNs)) missing.push(`${ns}.${key}`)
    }
    for (const key of Object.keys(localeNs)) {
      if (!keys.has(key)) extra.push(`${ns}.${key}`)
    }
  }

  if (missing.length > 0 || extra.length > 0) {
    hasErrors = true
    console.error(`\n${file}:`)
    for (const m of missing) console.error(`  missing: ${m}`)
    for (const e of extra) console.error(`  extra:   ${e}`)
  }
}

if (hasErrors) {
  console.error('\nLocale files are out of sync with messages.ts')
  process.exit(1)
} else {
  console.log('All locale files are in sync.')
}
