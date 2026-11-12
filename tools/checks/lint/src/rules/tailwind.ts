import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import {
  type ClassVisitor,
  visitScript,
  visitTemplateBinding
} from '#lint/support/class-sources.ts'
import { normalizedFilename } from '#lint/support/context.ts'
import {
  VUE_DIRECTIVE_NODE,
  VUE_ELEMENT_NODE,
  isVueSourceFile,
  vueTemplateAst,
  walkVueTemplateAst
} from '#lint/support/vue.ts'
import type { TemplateLiteral } from '@oxc-project/types'
import { defineRule } from '@oxlint/plugins'
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

function isThemeModule(file: string): boolean {
  return file.startsWith('src/theme/') || file.includes('/src/theme/')
}

/**
 * Every class list Tailwind reads in a file: in its script (`visitScript`), and in a Vue file the
 * template's `class` attributes and `:class` and `:ui` bindings, handed to `templateText`
 * without positions, since oxlint holds only the script's.
 */
function visitClassSources(
  file: string,
  source: string,
  script: ClassVisitor,
  templateText: (text: string) => void
): void {
  visitScript(source, file, isThemeModule(file), script)
  if (!isVueSourceFile(file)) return
  const template = vueTemplateAst(source, file)
  if (!template) return
  const binding: ClassVisitor = { text: ({ text }) => templateText(text) }
  walkVueTemplateAst(template, (templateNode) => {
    if (templateNode.type !== VUE_ELEMENT_NODE) return
    for (const prop of templateNode.props) {
      if (prop.type !== VUE_DIRECTIVE_NODE) {
        if (prop.name === 'class' && prop.value) templateText(prop.value.content)
        continue
      }
      const arg = prop.arg?.type === 4 ? prop.arg.content : null
      const expression = prop.exp?.type === 4 ? prop.exp.content : null
      if (prop.name === 'bind' && (arg === 'class' || arg === 'ui') && expression)
        visitTemplateBinding(arg, expression, binding)
    }
  })
}

/** Why a class is a problem for a rule, or null; `theme` builds the file's classes. */
type ClassCheck = (theme: Theme, className: string, file: string) => string | null

/** A rule over every class Tailwind reads in a file (`visitClassSources`). */
function defineClassRule(description: string, problemFor: ClassCheck) {
  return defineRule({
    meta: { type: 'problem', docs: { description } },
    create(context) {
      const file = normalizedFilename(context)
      const theme = themeFor(file)
      if (!theme) return {}
      const { sourceCode } = context
      const problems = (text: string) =>
        compact(classNames(text).map((className) => problemFor(theme, className, file)))
      return {
        Program(program) {
          visitClassSources(
            file,
            sourceCode.getText(),
            {
              text({ text, start, end }) {
                const loc = {
                  start: sourceCode.getLocFromIndex(start),
                  end: sourceCode.getLocFromIndex(end)
                }
                for (const problem of problems(text))
                  context.report({ loc, message: `Tailwind class: ${problem}.` })
              }
            },
            (text) => {
              for (const problem of problems(text))
                context.report({ node: program, message: `Tailwind class: ${problem}.` })
            }
          )
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

/**
 * Require a class list built from shared classes to be an array, as tailwind-variants takes it:
 * `['size-3.5 shrink-0', motionStyles.spinner]`, not `` `size-3.5 shrink-0 ${motionStyles.spinner}` ``.
 * Interpolating hides the composed classes from the class checks above and from Tailwind's editor
 * tooling, and a missing space silently fuses two classes into one.
 */
export const noInterpolatedTailwindClassesRule = defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'Require class lists composed from shared classes to be arrays.' }
  },
  create(context) {
    const report = (literal: TemplateLiteral) =>
      context.report({
        loc: {
          start: context.sourceCode.getLocFromIndex(literal.start),
          end: context.sourceCode.getLocFromIndex(literal.end)
        },
        message:
          "Compose Tailwind classes as an array, such as `['size-3.5', motionStyles.spinner]`, not by interpolating into a string."
      })
    const visitor: ClassVisitor = { interpolated: report }
    const file = normalizedFilename(context)
    return {
      Program() {
        visitScript(context.sourceCode.getText(), file, isThemeModule(file), visitor)
      }
    }
  }
})

/** Utilities that name a physical side, by root, and the logical ones that follow the reading direction. */
const LOGICAL_ROOTS: Record<string, string> = {
  ml: 'ms',
  mr: 'me',
  pl: 'ps',
  pr: 'pe',
  left: 'inset-s',
  right: 'inset-e',
  start: 'inset-s',
  end: 'inset-e',
  'border-l': 'border-s',
  'border-r': 'border-e',
  'rounded-l': 'rounded-s',
  'rounded-r': 'rounded-e',
  'rounded-tl': 'rounded-ss',
  'rounded-tr': 'rounded-se',
  'rounded-bl': 'rounded-es',
  'rounded-br': 'rounded-ee',
  'scroll-ml': 'scroll-ms',
  'scroll-mr': 'scroll-me',
  'scroll-pl': 'scroll-ps',
  'scroll-pr': 'scroll-pe',
  'text-left': 'text-start',
  'text-right': 'text-end',
  'float-left': 'float-start',
  'float-right': 'float-end',
  'clear-left': 'clear-start',
  'clear-right': 'clear-end'
}

/** Position utilities that `-1/2` puts at the middle whichever side they measure from. */
const CENTER_ROOTS = new Set(['left', 'right', 'start', 'end'])

/** The utility after a class's variants: `ml-2` in `data-[side=left]:hover:ml-2`. */
function utilityStart(className: string): number {
  let depth = 0
  let start = 0
  for (let index = 0; index < className.length; index++) {
    const char = className[index]
    if (char === '[' || char === '(') depth++
    else if (char === ']' || char === ')') depth--
    else if (char === ':' && depth === 0) start = index + 1
  }
  return start
}

/**
 * The logical class for a class that names a physical side, such as `ms-2` for `ml-2`, or null.
 * `start-*` and `end-*` are Tailwind's deprecated names for `inset-s-*` and `inset-e-*`.
 */
export function logicalClass(system: DesignSystem, className: string): string | null {
  for (const candidate of system.parseCandidate(className)) {
    if (candidate.kind === 'arbitrary') continue
    const negative = candidate.root.startsWith('-')
    const root = negative ? candidate.root.slice(1) : candidate.root
    const logical = LOGICAL_ROOTS[root]
    if (!logical) continue
    const start = utilityStart(className)
    const utility = className.slice(start)
    const prefix = negative ? `-${root}` : root
    const at = utility.indexOf(prefix)
    if (at === -1) continue
    // Half the width from either side is the middle in both directions: `left-1/2` with
    // `-translate-x-1/2` centers an element, and `inset-s-1/2` beside that physical translate would not.
    if (CENTER_ROOTS.has(root) && utility.slice(at + prefix.length) === '-1/2') return null
    const replaced = `${className.slice(0, start)}${utility.slice(0, at)}${negative ? '-' : ''}${logical}${utility.slice(at + prefix.length)}`
    return system.candidatesToCss([replaced])[0] ? replaced : null
  }
  return null
}

/**
 * Require the logical form of a utility that names a side, so the interface can follow a
 * right-to-left reading direction: `ms-2`, `ps-2`, `inset-s-0`, `border-s`, `rounded-s`,
 * `text-start`.
 */
export const noPhysicalSideTailwindClassesRule = defineClassRule(
  'Require Tailwind utilities that name a side to follow the reading direction.',
  (theme, className, file) => {
    if (!INTERFACE_SOURCES.some((root) => file.startsWith(root) || file.includes(`/${root}`)))
      return null
    const logical = logicalClass(theme.system, className)
    return logical
      ? `use \`${logical}\` instead of \`${className}\` so the side follows the reading direction`
      : null
  }
)
