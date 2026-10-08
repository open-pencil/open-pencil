# @open-pencil/emit

How OpenPencil's exporters emit source code. Build JavaScript, TypeScript, and JSX as ESTree nodes and print them with [esrap](https://github.com/sveltejs/esrap), instead of concatenating strings.

```ts
import { jsx } from '@open-pencil/emit'

const card = jsx.element(
  'Card',
  [jsx.attribute('title', jsx.stringValue('Fish & chips'))],
  [jsx.text('Hello')],
  0,
  true
)
jsx.printJSX(card) // <Card title={"Fish & chips"}>Hello</Card>
```

`jsx.stringValue` and `jsx.text` keep a value as plain JSX only when JSX reads it back unchanged; anything with quotes, entities, braces, angle brackets, backslashes, or line breaks becomes a string literal. `jsx.printModule` prints a whole TSX module, such as an `es` template filled with JSX, quoting every string the same way; dotted tags such as `Switch.Root` print as members of a namespace, and `jsx.spread` passes an object on as attributes.

`es` parses TypeScript templates, fills `$name` placeholders, and prints modules:

```ts
import { es } from '@open-pencil/emit'

const module = es.fill(es.parseModule("export const title = '$title'"), {
  $title: es.string('Checkout')
})
es.printModule(module) // export const title = 'Checkout';
```

`vue` builds templates and single-file components. Text and attribute values are escaped as HTML with `entities`, and text also writes `{` as an entity, since Vue reads `{{` as an interpolation before it decodes entities:

```ts
import { es, vue } from '@open-pencil/emit'

const template = vue.element('SwitchRoot', [vue.attribute('class', 'switch'), vue.model(es.identifier('checked'))])
vue.printTemplate(template) // <SwitchRoot class="switch" v-model="checked" />
```
