import { staticMemberName } from '#oxlint-plugin/support/ast'
import { defineRule } from '@oxlint/plugins'

const FACTORIES = new Set(['Make', 'MakeForBlender', 'MakeForColorFilter', 'MakeForShader'])

/**
 * Skia runtime programs come from one compiler, which the program tests run over every program;
 * a direct `RuntimeEffect.Make` skips their checks. Turn it off for that compiler.
 */
export const noRawRuntimeEffectRule = defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'Disallow compiling SkSL with RuntimeEffect.Make outside the compiler.' },
    messages: {
      raw: "Compile SkSL only through the project's own compiler, where tests compile every program and check its uniforms."
    }
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const { callee } = node
        if (callee.type !== 'MemberExpression' || !FACTORIES.has(staticMemberName(callee) ?? ''))
          return
        const owner = callee.object
        const named =
          (owner.type === 'Identifier' && owner.name === 'RuntimeEffect') ||
          (owner.type === 'MemberExpression' && staticMemberName(owner) === 'RuntimeEffect')
        if (named) context.report({ node, messageId: 'raw' })
      }
    }
  }
})
