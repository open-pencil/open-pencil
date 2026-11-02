import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { normalizedFilename } from '#lint/support/context.ts'
import {
  VUE_DIRECTIVE_NODE,
  VUE_ELEMENT_NODE,
  isVueSourceFile,
  vueTemplateAst,
  walkVueTemplateAst
} from '#lint/support/vue.ts'
import { defineRule } from '@oxlint/plugins'
import type { ESTree } from '@oxlint/plugins'
import { __unstable__loadDesignSystem } from '@tailwindcss/node'
import { compact } from 'es-toolkit/array'

type DesignSystem = Awaited<ReturnType<typeof __unstable__loadDesignSystem>>

interface Theme {
  stylesheet: string
  /** Tailwind's own model of the stylesheet's theme, utilities, and variants. */
  system: DesignSystem
}

/**
 * The stylesheet that builds each part of the repository, first match first: the SDK's
 * primitives and their examples, and the landing page, render in the docs site, everything else
 * in the app.
 */
const STYLESHEETS = [
  { files: 'packages/vue/src/', stylesheet: 'packages/docs/.vitepress/theme/tailwind.css' },
  { files: 'packages/docs/.vitepress/', stylesheet: 'packages/docs/.vitepress/theme/tailwind.css' },
  { files: '', stylesheet: 'src/app.css' }
]

/**
 * `bun run lint` and the rule's tests run Oxlint from the repository root; a run elsewhere has
 * no stylesheet to check against, and the rule stays quiet rather than keep the plugin's other
 * rules from loading.
 */
async function loadTheme(stylesheet: string): Promise<Theme | null> {
  const path = resolve(stylesheet)
  if (!existsSync(path)) return null
  const system = await __unstable__loadDesignSystem(readFileSync(path, 'utf8'), {
    base: dirname(path)
  })
  return { stylesheet, system }
}

const themes = await Promise.all(
  STYLESHEETS.map(async ({ files, stylesheet }) => ({ files, theme: await loadTheme(stylesheet) }))
)

function themeFor(file: string): Theme | null {
  const match = themes.find(({ files }) => file.startsWith(files) || file.includes(`/${files}`))
  return match?.theme ?? null
}

const verdicts = new WeakMap<Theme, Map<string, string | null>>()

/**
 * Why Tailwind cannot use a class, or null when it can or the class is not Tailwind's. A class
 * Tailwind parses as a utility but compiles to nothing names a value the theme lacks, such as a
 * color with no token. A color written as `[var(--color-*)]` has a utility of its own.
 */
function classProblem(theme: Theme, className: string): string | null {
  const { system, stylesheet } = theme
  let cache = verdicts.get(theme)
  if (!cache) {
    cache = new Map()
    verdicts.set(theme, cache)
  }
  const cached = cache.get(className)
  if (cached !== undefined) return cached
  const candidates = system.parseCandidate(className)
  const [css] = system.candidatesToCss([className])
  let problem: string | null = null
  if (!css) {
    if (candidates.length > 0)
      problem = `Tailwind has no \`${className}\`; ${stylesheet} defines no such value`
  } else {
    for (const candidate of candidates) {
      if (candidate.kind !== 'functional' || candidate.value?.kind !== 'arbitrary') continue
      const color = /^var\(--color-([\w-]+)\)$/.exec(candidate.value.value)
      if (!color) continue
      problem =
        system.resolveThemeValue(`--color-${color[1]}`) === undefined
          ? `\`${className}\` names \`--color-${color[1]}\`, which ${stylesheet} does not define`
          : `use \`${candidate.root}-${color[1]}\` instead of \`${className}\``
    }
  }
  cache.set(className, problem)
  return problem
}

function classNames(text: string): string[] {
  return compact(text.split(/\s+/))
}

const CLASS_KEYS = new Set(['class', 'className'])

/**
 * The class strings in a `:class` binding's source: array items and object keys, and values only
 * under `class`, since other keys pass arguments such as a variant (`menu({ justify: 'start' })`).
 */
function boundClassStrings(expression: string): string[] {
  const strings = /(?:([\w$]+)\s*:\s*)?(?:'([^']*)'|"([^"]*)"|`([^`$]*)`)/g
  return [...expression.matchAll(strings)].flatMap(([, key, ...quoted]) =>
    key && !CLASS_KEYS.has(key) ? [] : [quoted.find((text) => text !== undefined) ?? '']
  )
}

function propertyKey(node: ESTree.Node): string | null {
  if (node.type !== 'Property') return null
  if (node.key.type === 'Identifier') return node.key.name
  return node.key.type === 'Literal' && typeof node.key.value === 'string' ? node.key.value : null
}

/**
 * Whether a string is a class list, following tailwind-variants: `defaultVariants` and the
 * conditions of `compoundVariants` entries select variants, and their `class` holds classes.
 * Type literals and module paths are not classes either.
 */
function isClassString(node: ESTree.Node): boolean {
  let child: ESTree.Node = node
  for (let parent = node.parent; parent; child = parent, parent = parent.parent) {
    if (parent.type === 'TSLiteralType') return false
    if (
      (parent.type === 'ImportDeclaration' ||
        parent.type === 'ExportNamedDeclaration' ||
        parent.type === 'ExportAllDeclaration') &&
      parent.source === child
    )
      return false
    const key = propertyKey(parent)
    if (key === 'defaultVariants') return false
    const entry = parent.parent
    if (
      key !== null &&
      child === (parent.type === 'Property' ? parent.value : null) &&
      entry?.type === 'ObjectExpression' &&
      entry.parent?.type === 'ArrayExpression' &&
      propertyKey(entry.parent.parent ?? entry) === 'compoundVariants'
    )
      return CLASS_KEYS.has(key)
  }
  return true
}

const CLASS_HELPERS = new Set(['tv', 'twMerge', 'twJoin'])

function isClassHelperCall(node: ESTree.CallExpression): boolean {
  return node.callee.type === 'Identifier' && CLASS_HELPERS.has(node.callee.name)
}

/** Why a class is a problem for a rule, or null; `theme` builds the file's classes. */
type ClassCheck = (theme: Theme, className: string, file: string) => string | null

/**
 * A rule over every class Tailwind reads: Vue class attributes and bindings, `tv`, `twMerge` and
 * `twJoin` calls, and theme modules under `src/theme/`.
 */
function defineClassRule(description: string, problemFor: ClassCheck) {
  return defineRule({
    meta: { type: 'problem', docs: { description } },
    create(context) {
      const file = normalizedFilename(context)
      const theme = themeFor(file)
      if (!theme) return {}
      const themeModule = file.startsWith('src/theme/') || file.includes('/src/theme/')

      const check = (node: ESTree.Node, text: string) => {
        for (const className of classNames(text)) {
          const problem = problemFor(theme, className, file)
          if (problem) context.report({ node, message: `Tailwind class: ${problem}.` })
        }
      }

      function checkStrings(node: ESTree.Node) {
        if (!isClassString(node)) return
        if (node.type === 'Literal' && typeof node.value === 'string') check(node, node.value)
        else if (node.type === 'TemplateLiteral')
          for (const quasi of node.quasis) check(node, quasi.value.cooked ?? quasi.value.raw)
      }

      let helperDepth = 0
      return {
        Program(node) {
          if (!isVueSourceFile(file)) return
          const template = vueTemplateAst(context.sourceCode.getText(), file)
          if (!template) return
          walkVueTemplateAst(template, (templateNode) => {
            if (templateNode.type !== VUE_ELEMENT_NODE) return
            for (const prop of templateNode.props) {
              if (prop.type !== VUE_DIRECTIVE_NODE) {
                if (prop.name === 'class' && prop.value) check(node, prop.value.content)
                continue
              }
              const arg = prop.arg?.type === 4 ? prop.arg.content : null
              const expression = prop.exp?.type === 4 ? prop.exp.content : null
              if (prop.name === 'bind' && arg === 'class' && expression)
                for (const text of boundClassStrings(expression)) check(node, text)
            }
          })
        },
        CallExpression(node) {
          if (isClassHelperCall(node)) helperDepth++
        },
        'CallExpression:exit'(node: ESTree.CallExpression) {
          if (isClassHelperCall(node)) helperDepth--
        },
        Literal(node) {
          if (themeModule || helperDepth > 0) checkStrings(node)
        },
        TemplateLiteral(node) {
          if (themeModule || helperDepth > 0) checkStrings(node)
        }
      }
    }
  })
}

/**
 * Require every class Tailwind reads to be one it can build. It drops a class it does not know
 * without a warning, so a typo or a color with no token leaves the element unstyled.
 */
export const noUnknownTailwindClassesRule = defineClassRule(
  'Require Tailwind classes to be ones the app theme can build.',
  (theme, className) => classProblem(theme, className)
)

/** Sources sized with the interface: the app and the SDK's primitives. */
const INTERFACE_SOURCES = ['src/', 'packages/vue/src/']
const PX_LENGTH = /(?:^|[\s(,])-?(?:\d*\.)?\d+px\b/i

/**
 * The pixel length in a class's arbitrary value, such as `text-[11px]` or `grid-cols-[24px_1fr]`.
 * Shadows keep pixel offsets: they are decoration, not layout. `content` values are text.
 */
function pxValue(theme: Theme, className: string): string | null {
  for (const candidate of theme.system.parseCandidate(className)) {
    const value = arbitraryValue(candidate)
    if (value !== null && PX_LENGTH.test(value)) return value
  }
  return null
}

type Candidate = ReturnType<DesignSystem['parseCandidate']>[number]

/** Whether a utility or property takes values that are not sizes: shadows and text content. */
function exempt(name: string): boolean {
  return name.endsWith('shadow') || name === 'content'
}

/** A class's arbitrary size value, `[width:10px]` or `w-[10px]`. */
function arbitraryValue(candidate: Candidate): string | null {
  if (candidate.kind === 'arbitrary') return exempt(candidate.property) ? null : candidate.value
  if (candidate.kind !== 'functional' || candidate.value?.kind !== 'arbitrary') return null
  return exempt(candidate.root) ? null : candidate.value.value
}

/**
 * Require interface sizes in rem, so the interface follows the root font size: Tailwind's scale,
 * the theme's text sizes, or a rem arbitrary value.
 */
export const noPxTailwindValuesRule = defineClassRule(
  'Require Tailwind sizes in the interface to be in rem.',
  (theme, className, file) => {
    if (!INTERFACE_SOURCES.some((root) => file.startsWith(root) || file.includes(`/${root}`)))
      return null
    if (pxValue(theme, className) === null) return null
    return `size \`${className}\` in rem so it follows the root font size: use the spacing scale (\`h-6.5\`), a theme size (\`text-2xs\`, \`rounded-md\`), or a rem value`
  }
)
