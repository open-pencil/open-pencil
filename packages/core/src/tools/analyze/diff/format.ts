import type { DiffOperation } from './operations'

/**
 * A patch is a list of hunks. Each header names a node by path, for reading, and by ID, which
 * locates it; JSX attribute lines follow, `-` for the old value and `+` for the new one:
 *
 *   @@ /Card #1:2
 *   -rounded={12}
 *   +rounded={16}
 *   @@ /Card/Badge #1:5 moved to 0
 *   @@ /Card/Note #1:8 removed
 *   @@ /Card/Price added to #1:2 at 3
 *   +<Text name="Price" size={24}>$9</Text>
 */
function formatOperation(operation: DiffOperation): string[] {
  switch (operation.kind) {
    case 'update':
      return [
        `@@ ${operation.path} #${operation.id}`,
        ...operation.removed.map((source) => `-${source}`),
        ...operation.added.map((source) => `+${source}`)
      ]
    case 'remove':
      return [`@@ ${operation.path} #${operation.id} removed`]
    case 'move':
      return [`@@ ${operation.path} #${operation.id} moved to ${operation.index}`]
  }
  return [
    `@@ ${operation.path} added to #${operation.parentId} at ${operation.index}`,
    ...operation.jsx.split('\n').map((line) => `+${line}`)
  ]
}

export function formatOperations(operations: DiffOperation[]): string {
  return operations.flatMap(formatOperation).join('\n')
}

/** Headers anchor on their endings, so a name containing ` #` or `removed` still parses. */
const HEADERS: [RegExp, (match: RegExpExecArray) => DiffOperation][] = [
  [
    /^@@ (.*) added to #(\S+) at (\d+)$/,
    ([, path, parentId, index]) => ({ kind: 'add', path, parentId, index: Number(index), jsx: '' })
  ],
  [/^@@ (.*) #(\S+) removed$/, ([, path, id]) => ({ kind: 'remove', path, id })],
  [
    /^@@ (.*) #(\S+) moved to (\d+)$/,
    ([, path, id, index]) => ({ kind: 'move', path, id, index: Number(index) })
  ],
  [/^@@ (.*) #(\S+)$/, ([, path, id]) => ({ kind: 'update', path, id, removed: [], added: [] })]
]

function parseHeader(line: string): DiffOperation | null {
  for (const [pattern, build] of HEADERS) {
    const match = pattern.exec(line)
    if (match) return build(match)
  }
  return null
}

function addBodyLine(operation: DiffOperation, line: string): boolean {
  const marker = line[0]
  const body = line.slice(1)
  if (operation.kind === 'update' && (marker === '-' || marker === '+')) {
    ;(marker === '-' ? operation.removed : operation.added).push(body)
    return true
  }
  if (operation.kind === 'add' && marker === '+') {
    operation.jsx = operation.jsx ? `${operation.jsx}\n${body}` : body
    return true
  }
  return false
}

/** Parse a patch from `formatOperations`; throws naming the first line it cannot read. */
export function parseOperations(text: string): DiffOperation[] {
  const operations: DiffOperation[] = []
  for (const [index, raw] of text.split('\n').entries()) {
    const line = raw.replace(/\r$/, '')
    if (line.trim() === '') continue
    if (line.startsWith('@@ ')) {
      const operation = parseHeader(line)
      if (!operation) throw new Error(`Line ${index + 1}: unrecognized hunk header: ${line}`)
      operations.push(operation)
      continue
    }
    const current = operations.at(-1)
    if (!current || !addBodyLine(current, line)) {
      throw new Error(`Line ${index + 1}: unexpected line: ${line}`)
    }
  }
  return operations
}
