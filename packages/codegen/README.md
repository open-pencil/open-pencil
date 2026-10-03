# @open-pencil/codegen

Syntax-tree code generation for OpenPencil's exporters. Build JavaScript, TypeScript, and JSX as ESTree nodes and print them with [esrap](https://github.com/sveltejs/esrap), instead of concatenating strings.

```ts
import { jsx } from '@open-pencil/codegen'

const card = jsx.element(
  'Card',
  [jsx.attribute('title', jsx.stringValue('Fish & chips'))],
  [jsx.text('Hello')],
  0,
  true
)
jsx.printJSX(card) // <Card title={"Fish & chips"}>Hello</Card>
```

`jsx.stringValue` and `jsx.text` keep a value as plain JSX only when JSX reads it back unchanged; anything with quotes, entities, braces, angle brackets, backslashes, or line breaks becomes a string literal.

`es` parses TypeScript templates, fills `$name` placeholders, and prints modules:

```ts
import { es } from '@open-pencil/codegen'

const module = es.fill(es.parseModule("export const title = '$title'"), {
  $title: es.string('Checkout')
})
es.printModule(module) // export const title = 'Checkout';
```
