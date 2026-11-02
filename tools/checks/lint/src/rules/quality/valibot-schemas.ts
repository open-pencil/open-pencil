import { normalizedFilename } from '#lint/support/context.ts'
import { defineRule } from '@oxlint/plugins'
import type { ESTree } from '@oxlint/plugins'

/**
 * The Valibot functions that build a schema: those whose declared return type is a schema, in
 * Valibot's own declarations. Actions, runners, and helpers such as `getTitle` are left out.
 */
const SCHEMA_BUILDERS = new Set([
  'any',
  'array',
  'arrayAsync',
  'bigint',
  'blob',
  'boolean',
  'cache',
  'cacheAsync',
  'config',
  'custom',
  'customAsync',
  'date',
  'enum',
  'enum_',
  'exactOptional',
  'exactOptionalAsync',
  'fallback',
  'fallbackAsync',
  'file',
  'function',
  'function_',
  'instance',
  'intersect',
  'intersectAsync',
  'keyof',
  'lazy',
  'lazyAsync',
  'literal',
  'looseObject',
  'looseObjectAsync',
  'looseTuple',
  'looseTupleAsync',
  'map',
  'mapAsync',
  'message',
  'nan',
  'never',
  'nonNullable',
  'nonNullableAsync',
  'nonNullish',
  'nonNullishAsync',
  'nonOptional',
  'nonOptionalAsync',
  'null',
  'null_',
  'nullable',
  'nullableAsync',
  'nullish',
  'nullishAsync',
  'number',
  'object',
  'objectAsync',
  'objectWithRest',
  'objectWithRestAsync',
  'omit',
  'optional',
  'optionalAsync',
  'partial',
  'partialAsync',
  'pick',
  'picklist',
  'pipe',
  'pipeAsync',
  'promise',
  'record',
  'recordAsync',
  'required',
  'requiredAsync',
  'set',
  'setAsync',
  'strictObject',
  'strictObjectAsync',
  'strictTuple',
  'strictTupleAsync',
  'string',
  'symbol',
  'tuple',
  'tupleAsync',
  'tupleWithRest',
  'tupleWithRestAsync',
  'undefined',
  'undefined_',
  'undefinedable',
  'undefinedableAsync',
  'union',
  'unionAsync',
  'unknown',
  'unwrap',
  'variant',
  'variantAsync',
  'void',
  'void_'
])
const SCHEMA_NAME = /^[a-z][A-Za-z0-9]*Schema$/

/** Exported schemas live in a `schema.ts`, or in a Cloud contract module, where a reader looks. */
function placesExportedSchemas(file: string): boolean {
  return file.endsWith('/schema.ts') || file.includes('/packages/cloud/src/contract/')
}

/** The call a declaration's value is, past `as` and `satisfies`. */
function callOf(node: ESTree.Expression | null | undefined): ESTree.CallExpression | null {
  let current = node
  while (current?.type === 'TSAsExpression' || current?.type === 'TSSatisfiesExpression') {
    current = current.expression
  }
  return current?.type === 'CallExpression' ? current : null
}

type Options = { placement?: boolean }

/**
 * Name every module-level Valibot schema `<name>Schema` in camelCase, and export schemas only
 * from a `schema.ts` (or a Cloud contract module), so schemas read alike and are found in one
 * place per domain. `placement: false` checks names only, as for repository tooling.
 */
export const valibotSchemaConventionsRule = defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Name Valibot schemas <name>Schema and export them only from schema.ts.'
    },
    schema: [
      {
        type: 'object',
        properties: { placement: { type: 'boolean' } },
        additionalProperties: false
      }
    ],
    messages: {
      name: 'Name the Valibot schema "{{name}}" in camelCase ending in "Schema", such as "{{suggestion}}".',
      place:
        'Export the Valibot schema "{{name}}" from the domain\'s schema.ts, or keep it private to this module.'
    }
  },
  create(context) {
    const options: Options = (context.options[0] as Options | undefined) ?? {}
    const placement = options.placement !== false
    /** Local names bound to the Valibot namespace, and to its builders imported by name. */
    const namespaces = new Set<string>()
    const builders = new Set<string>()
    /** Module-level schemas declared without `export`, by name, with the identifier to report. */
    const privateSchemas = new Map<string, ESTree.Node>()
    const exportedNames: string[] = []

    function builds(call: ESTree.CallExpression | null): boolean {
      const callee = call?.callee
      if (callee?.type === 'Identifier') return builders.has(callee.name)
      return (
        callee?.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        namespaces.has(callee.object.name) &&
        callee.property.type === 'Identifier' &&
        SCHEMA_BUILDERS.has(callee.property.name)
      )
    }

    function reportPlacement(node: ESTree.Node, name: string) {
      if (placement && !placesExportedSchemas(normalizedFilename(context))) {
        context.report({ node, messageId: 'place', data: { name } })
      }
    }

    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'valibot') return
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportNamespaceSpecifier') namespaces.add(specifier.local.name)
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.type === 'Identifier' &&
            SCHEMA_BUILDERS.has(specifier.imported.name)
          ) {
            builders.add(specifier.local.name)
          }
        }
      },
      VariableDeclaration(node) {
        const exported = node.parent.type === 'ExportNamedDeclaration'
        if (node.parent.type !== 'Program' && !exported) return
        for (const declarator of node.declarations) {
          if (declarator.id.type !== 'Identifier' || !builds(callOf(declarator.init))) continue
          const name = declarator.id.name
          if (!SCHEMA_NAME.test(name)) {
            const base = name.replace(/(Schema|SCHEMA)$/, '') || name
            const suggestion = `${base.charAt(0).toLowerCase()}${base.slice(1)}Schema`
            context.report({ node: declarator.id, messageId: 'name', data: { name, suggestion } })
          }
          if (exported) reportPlacement(declarator.id, name)
          else privateSchemas.set(name, declarator.id)
        }
      },
      ExportNamedDeclaration(node) {
        // `export { x } from './y'` re-exports another module's binding, checked where it lives.
        if (node.source) return
        for (const specifier of node.specifiers) {
          if (specifier.local.type === 'Identifier') exportedNames.push(specifier.local.name)
        }
      },
      'Program:exit'() {
        // An `export { x }` may come before the declaration it names, so it is matched last.
        for (const name of exportedNames) {
          const node = privateSchemas.get(name)
          if (node) reportPlacement(node, name)
        }
      }
    }
  }
})
