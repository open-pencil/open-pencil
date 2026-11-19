import path from 'node:path'

import { collectFiles, type Diagnostic, relativePath, type Rule } from './support.ts'

/** Single-word names kept on purpose: `Tip` is the app's tooltip, used everywhere. */
const SINGLE_WORD_ALLOWLIST = new Set(['Tip'])

/** App components, without story examples: each belongs to the component whose stories show it. */
function appComponents(sourceRels: readonly string[]): string[] {
  return sourceRels.filter(
    (sourceRel) =>
      sourceRel.startsWith('src/components/') &&
      sourceRel.endsWith('.vue') &&
      !sourceRel.split('/').includes('examples')
  )
}

/** App components that share a file name with another one, grouped by that name. */
export function duplicateComponentNames(sourceRels: readonly string[]): Map<string, string[]> {
  const byName = new Map<string, string[]>()
  for (const sourceRel of appComponents(sourceRels)) {
    const name = path.basename(sourceRel)
    byName.set(name, [...(byName.get(name) ?? []), sourceRel])
  }
  return new Map([...byName].filter(([, files]) => files.length > 1))
}

/** App components named with one word, which can clash with HTML elements present and future. */
export function singleWordComponentNames(sourceRels: readonly string[]): string[] {
  return appComponents(sourceRels).filter((sourceRel) => {
    const name = path.basename(sourceRel, '.vue')
    // `Toaster`, or an acronym alone such as `SVG`; `SVGIcon` has two words.
    return /^(?:[A-Z][a-z0-9]*|[A-Z0-9]+)$/.test(name) && !SINGLE_WORD_ALLOWLIST.has(name)
  })
}

function componentRelativePaths(root: Parameters<Rule['check']>[0]) {
  return collectFiles(root).map((file) => relativePath(root.path, file))
}

export const uniqueComponentNames: Rule = {
  name: 'open-pencil/unique-component-names',
  check(root) {
    const diagnostics: Diagnostic[] = []
    for (const [name, duplicates] of duplicateComponentNames(componentRelativePaths(root))) {
      for (const sourceRel of duplicates) {
        diagnostics.push({
          message: `${name} is also ${duplicates.filter((other) => other !== sourceRel).join(', ')}; give each component a unique name.`,
          location: { path: path.join(root.path, sourceRel) }
        })
      }
    }
    return { diagnostics }
  }
}

export const multiWordComponentNames: Rule = {
  name: 'open-pencil/multi-word-component-names',
  check(root) {
    return {
      diagnostics: singleWordComponentNames(componentRelativePaths(root)).map((sourceRel) => ({
        message: `${path.basename(sourceRel)} is one word; start it with its feature, as in ChatReasoning.vue.`,
        location: { path: path.join(root.path, sourceRel) }
      }))
    }
  }
}
