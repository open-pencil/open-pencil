import { normalizedFilename, importSource } from './context.js'

export function createProgramFilenameRule({ description, check }) {
  return {
    meta: { type: 'suggestion', docs: { description }, schema: [] },
    create(context) {
      const message = check(normalizedFilename(context))
      if (!message) return {}
      return { Program: (node) => context.report({ node, message }) }
    }
  }
}

export function createImportSourceRule({
  description,
  applies = () => true,
  includeExports = false,
  check
}) {
  return {
    meta: { type: 'problem', docs: { description }, schema: [] },
    create(context) {
      const file = normalizedFilename(context)
      if (!applies(file)) return {}
      const inspect = (node) => {
        const source = importSource(node)
        if (!source) return
        const message = check(source, file)
        if (message) context.report({ node, message })
      }
      const visitors = { ImportDeclaration: inspect }
      if (includeExports) {
        visitors.ExportNamedDeclaration = inspect
        visitors.ExportAllDeclaration = inspect
      }
      return visitors
    }
  }
}
