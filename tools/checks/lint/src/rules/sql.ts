import { defineRule } from '@oxlint/plugins'

/**
 * Kysely's typed builder everywhere; raw `sql` templates only in migrations and reviewed helpers.
 * Applied to the Cloud server and the feedback Worker in oxlint.json.
 */
export const noRawSQLRule = defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'Disallow raw sql templates in server code that uses Kysely.' },
    messages: {
      raw: "Use Kysely's typed query builder; raw SQL belongs in migrations and reviewed helpers."
    }
  },
  createOnce(context) {
    return {
      TaggedTemplateExpression(node) {
        const { tag } = node
        const named =
          (tag.type === 'Identifier' && tag.name === 'sql') ||
          (tag.type === 'MemberExpression' &&
            tag.object.type === 'Identifier' &&
            tag.object.name === 'sql')
        if (named) context.report({ node, messageId: 'raw' })
      }
    }
  }
})
