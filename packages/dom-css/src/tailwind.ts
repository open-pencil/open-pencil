import { compile } from 'tailwindcss'

export interface CompileTailwindCSSOptions {
  css?: string
  base?: string
  loadStylesheet?: (id: string, base: string) => Promise<string>
}

const DEFAULT_TAILWIND_CSS = '@import "tailwindcss";'

export async function compileTailwindCSS(
  classes: string | Iterable<string>,
  options: CompileTailwindCSSOptions = {}
): Promise<string> {
  const compiler = await compile(tailwindCompilerCSS(options.css), {
    base: options.base,
    loadStylesheet: async (id, base) => {
      const content = options.loadStylesheet
        ? await options.loadStylesheet(id, base)
        : await loadTailwindStylesheet(id)
      return { path: id, base, content }
    }
  })
  return compiler.build(normalizeClasses(classes))
}

function tailwindCompilerCSS(css: string | undefined): string {
  const trimmed = css?.trim()
  if (!trimmed) return DEFAULT_TAILWIND_CSS
  if (containsTailwindImport(trimmed)) return trimmed
  return `${DEFAULT_TAILWIND_CSS}\n${trimmed}`
}

function containsTailwindImport(css: string): boolean {
  return /@import\s+(?:"tailwindcss"|'tailwindcss')/.test(css)
}

function normalizeClasses(classes: string | Iterable<string>): string[] {
  const classNames = typeof classes === 'string' ? [classes] : Array.from(classes)
  return classNames
    .flatMap((className) => className.split(/\s+/))
    .map((className) => className.trim())
    .filter((className) => className.length > 0)
}

async function loadTailwindStylesheet(id: string): Promise<string> {
  const stylesheet = id === 'tailwindcss' ? 'tailwindcss/index.css' : id
  const url = new URL(import.meta.resolve(stylesheet))
  const { readFile } = await import(/* @vite-ignore */ 'node:fs/promises')
  return readFile(url, 'utf8')
}
