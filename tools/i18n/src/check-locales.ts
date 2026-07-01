#!/usr/bin/env bun
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import type { JsonObject } from '@open-pencil/scene-graph/primitives'
import {
  LOCALE_DIR_NAMES,
  TRANSLATED_LOCALES,
  messageDefaults,
  type TranslatedLocale
} from '@open-pencil/vue'

const LOCALES_DIR = 'packages/vue/src/i18n/locales'
const LOCALE_FILE_NAMES: Record<string, string> = {
  variableTypes: 'variable-types'
}
const REQUIRED_INDEX_FILE = 'index.ts'

function localeFileName(namespace: string) {
  return LOCALE_FILE_NAMES[namespace] ?? namespace
}

function readJsonObject(path: string): JsonObject {
  return JSON.parse(readFileSync(path, 'utf-8')) as JsonObject
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
const expectedLocaleFiles = new Set(namespaces.map(localeFileName))

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

  for (const file of fileDiff.missing) missing.push(`${file}.*`)
  for (const file of fileDiff.extra) extra.push(`${file}.*`)

  for (const namespace of namespaces) {
    const path = join(localeDir, `${localeFileName(namespace)}.json`)
    if (!existsSync(path)) continue

    const expected = expectedKeys.get(namespace)
    if (!expected) continue

    const data = readJsonObject(path)
    for (const key of expected) {
      if (!(key in data)) missing.push(`${namespace}.${key}`)
    }
    for (const key of Object.keys(data)) {
      if (!expected.has(key)) extra.push(`${namespace}.${key}`)
    }
  }

  const extraNonJsonFiles = files.filter(
    (file) => file !== REQUIRED_INDEX_FILE && !file.endsWith('.json')
  )
  for (const file of extraNonJsonFiles) extra.push(file)

  if (missing.length > 0 || extra.length > 0) {
    hasErrors = true
    console.error(`\n${locale}:`)
    for (const key of missing.sort()) console.error(`  missing: ${key}`)
    for (const key of extra.sort()) console.error(`  extra:   ${key}`)
  }
}

if (hasErrors) {
  console.error('\nLocale files are out of sync with message defaults')
  process.exit(1)
}

console.log('All locale files are in sync.')
