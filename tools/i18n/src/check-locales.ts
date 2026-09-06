#!/usr/bin/env bun
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import type { JSONObject } from '@open-pencil/scene-graph/primitives'
import {
  LOCALE_DIR_NAMES,
  TRANSLATED_LOCALES,
  messageDefaults,
  type TranslatedLocale
} from '@open-pencil/vue'

import { hasMixedLatinAndCjk, placeholders } from './quality'

const LOCALES_DIR = 'packages/vue/src/i18n/locales'
const LOCALE_FILE_NAMES: Record<string, string> = {
  variableTypes: 'variable-types'
}
const REQUIRED_INDEX_FILE = 'index.ts'
const TRANSLATION_BASELINE_PATH = 'tools/i18n/translation-baseline.txt'
const MIXED_SCRIPT_BASELINE_PATH = 'tools/i18n/mixed-script-baseline.txt'

function sourceMessage(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'input' in value) {
    const input = (value as { input?: unknown }).input
    return typeof input === 'string' ? input : null
  }
  return null
}

function normalized(value: string): string {
  return value.normalize('NFKC').replaceAll(/\s+/g, ' ').trim()
}

function localeFileName(namespace: string) {
  return LOCALE_FILE_NAMES[namespace] ?? namespace
}

function readJSONObject(path: string): JSONObject {
  return JSON.parse(readFileSync(path, 'utf-8')) as JSONObject
}

function report(message: string) {
  hasErrors = true
  console.error(message)
}

function sameMembers(actual: Iterable<string>, expected: Iterable<string>) {
  const actualSet = new Set(actual)
  const expectedSet = new Set(expected)
  return {
    missing: [...expectedSet].filter((value) => !actualSet.has(value)).sort(),
    extra: [...actualSet].filter((value) => !expectedSet.has(value)).sort()
  }
}

const namespaces = Object.keys(messageDefaults)
const expectedKeys = new Map(
  Object.entries(messageDefaults).map(([namespace, messages]) => [
    namespace,
    new Set(Object.keys(messages))
  ])
)
const expectedLocaleDirs = new Map<TranslatedLocale, string>(
  TRANSLATED_LOCALES.map((locale) => [locale, LOCALE_DIR_NAMES[locale]])
)
const baselineLocaleId = (locale: TranslatedLocale): string => LOCALE_DIR_NAMES[locale]
const expectedLocaleFiles = new Set(namespaces.map(localeFileName))
const translationBaseline = new Set(
  readFileSync(TRANSLATION_BASELINE_PATH, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
)
const mixedScriptBaseline = new Set(
  readFileSync(MIXED_SCRIPT_BASELINE_PATH, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
)
const observedIdentical = new Set<string>()
const observedMixedScript = new Set<string>()

let hasErrors = false

const mappingLocales = Object.keys(LOCALE_DIR_NAMES)
const localeMappingDiff = sameMembers(mappingLocales, TRANSLATED_LOCALES)
for (const locale of localeMappingDiff.missing) {
  report(`LOCALE_DIR_NAMES is missing translated locale '${locale}'.`)
}
for (const locale of localeMappingDiff.extra) {
  report(`LOCALE_DIR_NAMES contains unknown translated locale '${locale}'.`)
}

const duplicateDirs = new Map<string, string[]>()
for (const [locale, dir] of Object.entries(LOCALE_DIR_NAMES)) {
  const locales = duplicateDirs.get(dir) ?? []
  locales.push(locale)
  duplicateDirs.set(dir, locales)
}
for (const [dir, locales] of duplicateDirs) {
  if (locales.length > 1) report(`Locale directory '${dir}' is shared by ${locales.join(', ')}.`)
}

const actualLocaleDirs = readdirSync(LOCALES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
const expectedDirs = [...expectedLocaleDirs.values()].sort()
const dirDiff = sameMembers(actualLocaleDirs, expectedDirs)
for (const dir of dirDiff.missing) report(`Missing locale directory '${dir}'.`)
for (const dir of dirDiff.extra) report(`Unexpected locale directory '${dir}'.`)

for (const [locale, dir] of expectedLocaleDirs) {
  const localeDir = join(LOCALES_DIR, dir)
  if (!existsSync(localeDir)) continue

  const files = readdirSync(localeDir)
  if (!files.includes(REQUIRED_INDEX_FILE)) {
    report(`\n${locale}: missing ${REQUIRED_INDEX_FILE}`)
  }

  const jsonFiles = files.filter((file) => file.endsWith('.json'))
  const namespaceFiles = new Set(jsonFiles.map((file) => file.slice(0, -5)))
  const fileDiff = sameMembers(namespaceFiles, expectedLocaleFiles)
  const missing: string[] = []
  const extra: string[] = []
  let translated = 0
  let total = 0

  for (const file of fileDiff.missing) missing.push(`${file}.*`)
  for (const file of fileDiff.extra) extra.push(`${file}.*`)

  for (const namespace of namespaces) {
    const path = join(localeDir, `${localeFileName(namespace)}.json`)
    if (!existsSync(path)) continue

    const expected = expectedKeys.get(namespace)
    if (!expected) continue

    const data = readJSONObject(path)
    const defaults = messageDefaults[namespace as keyof typeof messageDefaults]
    for (const key of expected) {
      if (!(key in data)) {
        missing.push(`${namespace}.${key}`)
        continue
      }
      const source = sourceMessage(defaults[key as keyof typeof defaults])
      const localized = data[key]
      if (source === null || typeof localized !== 'string') continue
      total++
      const id = `${baselineLocaleId(locale)}:${namespace}.${key}`
      if (placeholders(source).join(',') !== placeholders(localized).join(',')) {
        report(
          `${id}: placeholders differ from source (${placeholders(source).join(', ')} != ${placeholders(localized).join(', ')})`
        )
      }
      if ((locale === 'ja' || locale === 'zh-CN') && hasMixedLatinAndCjk(localized)) {
        observedMixedScript.add(id)
        if (!mixedScriptBaseline.has(id)) report(`${id}: mixed Latin/CJK scripts require review`)
      }
      if (normalized(source) === normalized(localized)) {
        observedIdentical.add(id)
        if (!translationBaseline.has(id))
          report(`${id}: translation is identical to the English source`)
      } else {
        translated++
      }
    }
    for (const key of Object.keys(data)) {
      if (!expected.has(key)) extra.push(`${namespace}.${key}`)
    }
  }

  if (total > 0) {
    const coverage = ((translated / total) * 100).toFixed(1)
    console.log(`${locale}: ${translated}/${total} translated (${coverage}%)`)
  }

  const extraNonJSONFiles = files.filter(
    (file) => file !== REQUIRED_INDEX_FILE && !file.endsWith('.json')
  )
  for (const file of extraNonJSONFiles) extra.push(file)

  if (missing.length > 0 || extra.length > 0) {
    hasErrors = true
    console.error(`\n${locale}:`)
    for (const key of missing.sort()) console.error(`  missing: ${key}`)
    for (const key of extra.sort()) console.error(`  extra:   ${key}`)
  }
}

for (const id of translationBaseline) {
  if (!observedIdentical.has(id)) report(`${id}: stale translation baseline entry`)
}
for (const id of mixedScriptBaseline) {
  if (!observedMixedScript.has(id)) report(`${id}: stale mixed-script baseline entry`)
}

if (hasErrors) {
  console.error('\nLocale files are out of sync with message defaults')
  process.exit(1)
}

console.log(
  'All locale files are structurally complete and translation quality is within baseline.'
)
