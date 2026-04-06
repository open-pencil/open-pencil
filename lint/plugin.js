const noInlineNamedTypes = {
  meta: {
    docs: {
      description: 'Disallow inline type literals that duplicate a named type',
    },
    schema: [
      {
        type: 'object',
        additionalProperties: {
          type: 'string',
        },
      },
    ],
  },
  create(context) {
    const typesOption = context.options[0]
    if (!typesOption || typeof typesOption !== 'object') return {}

    const shapeToName = new Map()
    for (const [name, shape] of Object.entries(typesOption)) {
      shapeToName.set(shape, name)
    }

    return {
      TSTypeLiteral(node) {
        const props = node.members?.filter(
          (m) => m.type === 'TSPropertySignature' && m.key?.type === 'Identifier',
        )
        if (!props || props.length < 2) return

        const required = props.filter((m) => !m.optional)
        if (required.length < 2) return

        const shape = required
          .map((m) => {
            const typeNode = m.typeAnnotation?.typeAnnotation
            let typeName = 'unknown'
            if (typeNode) {
              switch (typeNode.type) {
                case 'TSNumberKeyword': typeName = 'number'; break
                case 'TSStringKeyword': typeName = 'string'; break
                case 'TSBooleanKeyword': typeName = 'boolean'; break
              }
            }
            return `${m.key.name}:${typeName}`
          })
          .sort()
          .join(',')

        const namedType = shapeToName.get(shape)
        if (namedType) {
          context.report({
            node,
            message: `Use '${namedType}' instead of inline type literal. Import from '@open-pencil/core'.`,
          })
        }
      },
    }
  },
}

const noStructuredCloneSceneArrays = {
  meta: {
    docs: {
      description:
        'Disallow structuredClone on fills/strokes/effects — use typed copy helpers from copy.ts',
    },
    schema: [
      {
        type: 'array',
        items: { type: 'string' },
        description: 'Property names that should use typed copy helpers',
      },
    ],
  },
  create(context) {
    const props = new Set(context.options[0] ?? [
      'fills', 'strokes', 'effects', 'styleRuns', 'fillGeometry', 'strokeGeometry',
    ])
    return {
      CallExpression(node) {
        if (node.callee?.type !== 'Identifier' || node.callee.name !== 'structuredClone') return
        if (node.arguments?.length !== 1) return
        const arg = node.arguments[0]
        if (arg.type === 'MemberExpression' && arg.property?.type === 'Identifier') {
          if (props.has(arg.property.name)) {
            context.report({
              node,
              message: `Use the typed copy helper instead of structuredClone for '${arg.property.name}'. Import from '@open-pencil/core'.`,
            })
          }
        }
      },
    }
  },
}

const noMathRandom = {
  meta: {
    docs: {
      description: 'Disallow Math.random() — use crypto.getRandomValues() instead',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee?.type === 'MemberExpression' &&
          node.callee.object?.type === 'Identifier' &&
          node.callee.object.name === 'Math' &&
          node.callee.property?.type === 'Identifier' &&
          node.callee.property.name === 'random'
        ) {
          context.report({
            node,
            message: 'Use crypto.getRandomValues() instead of Math.random().',
          })
        }
      },
    }
  },
}

const noHandRolledColor = {
  meta: {
    docs: {
      description:
        'Disallow hand-rolled color conversions — use helpers from color.ts (colorToCSS, colorToHex, parseColor, etc.)',
    },
  },
  create(context) {
    const file = context.filename ?? context.getFilename?.()
    if (file?.includes('/color') && /(?:color\.ts|color\/index\.ts)$/.test(file)) return {}

    return {
      TemplateLiteral(node) {
        const raw = context.sourceCode.getText(node)
        if (/rgba?\s*\(/.test(raw)) {
          context.report({
            node,
            message: "Use colorToCSS() or colorToHex() from color.ts instead of hand-rolled rgba()/rgb() strings.",
          })
        }
      },

    }
  },
}

const noRawConsoleFormat = {
  meta: {
    docs: {
      description:
        'Disallow hand-rolled formatting in console.log — use agentfmt helpers (bold, dim, kv, entity, fmtTree, fmtList, etc.)',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee?.type !== 'MemberExpression' ||
          node.callee.object?.type !== 'Identifier' ||
          node.callee.object.name !== 'console' ||
          node.callee.property?.type !== 'Identifier' ||
          node.callee.property.name !== 'log'
        ) return
        if (!node.arguments?.length) return

        for (const arg of node.arguments) {
          if (arg.type === 'TemplateLiteral' && arg.expressions?.length > 0) {
            context.report({
              node,
              message: 'Use agentfmt helpers (bold, dim, kv, entity, etc.) instead of template literals in console.log.',
            })
            return
          }
          if (arg.type === 'BinaryExpression' && arg.operator === '+') {
            context.report({
              node,
              message: 'Use agentfmt helpers (bold, dim, kv, entity, etc.) instead of string concatenation in console.log.',
            })
            return
          }
        }
      },
    }
  },
}

const noSilentCatch = {
  meta: {
    docs: {
      description:
        'Disallow empty catch blocks — log a warning or re-throw instead of silently swallowing errors',
    },
  },
  create(context) {
    return {
      CatchClause(node) {
        const body = node.body
        if (!body || !body.body) return
        const stmts = body.body.filter(
          (s) => s.type !== 'EmptyStatement',
        )
        if (stmts.length === 0) {
          context.report({
            node,
            message:
              'Empty catch block silently swallows errors. Add console.warn(), re-throw, or an explicit // oxlint-ignore-next-line comment.',
          })
        }
      },
    }
  },
}

const noTypeofWindowCheck = {
  meta: {
    docs: {
      description:
        'Disallow raw typeof window checks — use IS_BROWSER or IS_TAURI from constants',
    },
  },
  create(context) {
    const file = context.filename ?? context.getFilename?.()
    if (file?.endsWith('constants.ts')) return {}

    return {
      BinaryExpression(node) {
        if (node.operator !== '!==' && node.operator !== '===') return
        const isTypeofWindow = (side) =>
          side.type === 'UnaryExpression' &&
          side.operator === 'typeof' &&
          side.argument?.type === 'Identifier' &&
          side.argument.name === 'window'
        if (isTypeofWindow(node.left) || isTypeofWindow(node.right)) {
          context.report({
            node,
            message:
              "Use IS_BROWSER or IS_TAURI from constants instead of raw 'typeof window' checks.",
          })
        }
      },
    }
  },
}

const plugin = {
  meta: { name: 'open-pencil' },
  rules: {
    'no-inline-named-types': noInlineNamedTypes,
    'no-structuredclone-scene-arrays': noStructuredCloneSceneArrays,
    'no-math-random': noMathRandom,
    'no-hand-rolled-color': noHandRolledColor,
    'no-raw-console-format': noRawConsoleFormat,
    'no-silent-catch': noSilentCatch,
    'no-typeof-window-check': noTypeofWindowCheck,
  },
}

export default plugin
