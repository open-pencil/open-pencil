export {}

const { es, jsx } = await import('../dist/index.js')

const card = jsx.printJSX(
  jsx.element('Card', [jsx.attribute('title', jsx.stringValue('a "quoted" title'))], [], 0)
)
const module = es.printModule(es.parseModule('export const answer = 42'))
if (card !== '<Card title={"a \\"quoted\\" title"} />' || !module.includes('answer = 42')) {
  throw new Error('Expected built codegen package to print JSX and modules')
}
