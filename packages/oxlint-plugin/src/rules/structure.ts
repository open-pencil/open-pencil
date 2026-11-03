import { existsSync } from 'node:fs'

import { normalizedFilename } from '#oxlint-plugin/support/context'
import { defineRule } from '@oxlint/plugins'
import type { ESTree } from '@oxlint/plugins'

const noSiblingDomainPrefixedFiles = defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow files that repeat an existing sibling domain folder in the filename'
    },
    schema: []
  },
  create(context) {
    const file = normalizedFilename(context)
    const match = file.match(/^(.*\/)([^/]+?)(?:\.test|\.spec)?\.(?:ts|tsx|vue)$/)
    if (!match) return {}
    const [, directory = '', name = ''] = match
    // Only the prefix names a domain; suffixes describe kinds (page-list, color-input).
    const [prefix, ...rest] = name.split('-')
    if (!prefix || rest.length === 0 || !existsSync(`${directory}${prefix}`)) return {}
    const message = `Move '${file.slice(directory.length)}' under the existing '${prefix}/' folder instead of repeating the domain in the filename.`
    return { Program: (node) => context.report({ node, message }) }
  }
})

type FunctionBody = ESTree.FunctionBody | ESTree.Expression | null | undefined

function parameterNames(params: readonly ESTree.Node[]): string[] | null {
  const names: string[] = []
  for (const param of params) {
    if (param.type !== 'Identifier') return null
    names.push(param.name)
  }
  return names
}

function returnedCall(body: FunctionBody): ESTree.CallExpression | null {
  if (!body) return null
  if (body.type === 'CallExpression') return body
  if (body.type !== 'BlockStatement') return null
  const statements = body.body.filter((statement) => statement.type !== 'EmptyStatement')
  const [statement] = statements
  if (statements.length !== 1 || statement?.type !== 'ReturnStatement') return null
  return statement.argument?.type === 'CallExpression' ? statement.argument : null
}

const noUselessPassThroughWrappers = defineRule({
  meta: {
    docs: {
      description:
        'Disallow functions that only return another function call with the same arguments'
    }
  },
  create(context) {
    function check(
      node: ESTree.Node,
      name: string,
      params: readonly ESTree.Node[],
      body: FunctionBody
    ) {
      const names = parameterNames(params)
      if (!names) return
      const call = returnedCall(body)
      if (!call || call.arguments.length !== names.length) return
      const forwards = call.arguments.every(
        (argument, index) => argument.type === 'Identifier' && argument.name === names[index]
      )
      if (!forwards || call.callee.type !== 'Identifier') return
      const target = call.callee.name
      if (target === name) return
      context.report({
        node,
        message: `Remove pass-through wrapper '${name}'. Call '${target}' directly or give the wrapper real domain logic.`
      })
    }

    return {
      FunctionDeclaration(node) {
        if (node.id) check(node, node.id.name, node.params, node.body)
      },
      VariableDeclarator(node) {
        if (node.id.type !== 'Identifier') return
        const { init } = node
        if (init?.type !== 'ArrowFunctionExpression' && init?.type !== 'FunctionExpression') return
        check(node, node.id.name, init.params, init.body)
      }
    }
  }
})

export { noSiblingDomainPrefixedFiles, noUselessPassThroughWrappers }
