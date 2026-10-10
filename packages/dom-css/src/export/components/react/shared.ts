import { es, jsx } from '@open-pencil/emit'

import type { ComponentModel, GeneratedKind } from '../model'

export const IDENTIFIER = /^[A-Za-z_$][\w$]*$/

/** `styles.thumb`, or `styles['switch-thumb']` for a class that isn't an identifier. */
export function moduleClass(className: string): es.SyntaxNode {
  return {
    type: 'MemberExpression',
    object: es.identifier('styles'),
    property: IDENTIFIER.test(className) ? es.identifier(className) : es.string(className),
    computed: !IDENTIFIER.test(className),
    optional: false
  }
}

/** What a component's markup uses, which its module imports. */
export interface MarkupUses {
  component: ComponentModel
  kind: GeneratedKind
  choice: ComponentModel['choice']
  /** Other generated components. */
  components: Set<string>
  icons: boolean
}

export const numeric = (name: string, value: number) =>
  jsx.attribute(name, jsx.container(es.number(value)))
