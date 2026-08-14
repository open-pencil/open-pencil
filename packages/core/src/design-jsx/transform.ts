import { transform } from 'sucrase'

export function transformDesignJSXExpression(source: string): string {
  const options = {
    transforms: ['typescript', 'jsx'] as Array<'typescript' | 'jsx'>,
    jsxPragma: '__h',
    jsxFragmentPragma: '__fragment',
    production: true
  }
  return transform(`return (${source.trim()})`, options).code
}
