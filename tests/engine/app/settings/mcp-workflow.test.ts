import { beforeEach, afterEach, expect, test } from 'bun:test'

import { effectScope, ref } from 'vue'

import { mcpConnectionSettings, type MCPConnection } from '@/app/integrations/mcp'
import { useMCPConnectionSettings } from '@/app/integrations/mcp/settings/use'

const connection: MCPConnection = {
  id: 'mcp-test',
  name: 'Test',
  enabled: true,
  transport: { type: 'streamable-http', url: 'https://example.com/mcp' },
  authentication: { type: 'none' }
}

let previousConnections = mcpConnectionSettings.value.connections
beforeEach(() => {
  previousConnections = mcpConnectionSettings.value.connections
  mcpConnectionSettings.value.connections = [structuredClone(connection)]
})
afterEach(() => {
  mcpConnectionSettings.value.connections = previousConnections
})

test('MCP credential clear disables its captured target without changing a new draft', async () => {
  const scope = effectScope()
  let finish: () => void = () => undefined
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  const saved: boolean[] = []
  const token = ref('')
  try {
    const state = scope.run(() =>
      useMCPConnectionSettings(token, ref({ bearerTokenRequired: 'Required' }), {
        status: async () => 'configured',
        setCredential: async () => pending,
        save: (draft) => {
          saved.push(draft.enabled)
          return connection
        },
        remove: async () => undefined
      })
    )
    if (!state) throw new Error('Missing scope')
    state.draft.value.id = connection.id
    const clearing = state.clearCredential()
    state.startAdd()
    state.draft.value.enabled = true
    token.value = 'new-key'
    finish()
    await clearing
    expect(saved).toEqual([false])
    expect(state.draft.value.enabled).toBe(true)
    expect(token.value).toBe('new-key')
  } finally {
    scope.stop()
  }
})

test('MCP edit ignores credential status after another draft opens', async () => {
  const previous = mcpConnectionSettings.value.connections
  mcpConnectionSettings.value.connections = [connection]
  const scope = effectScope()
  let finish: () => void = () => undefined
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  try {
    const state = scope.run(() =>
      useMCPConnectionSettings(ref(''), ref({ bearerTokenRequired: 'Required' }), {
        status: async () => {
          await pending
          return 'configured'
        },
        setCredential: async () => undefined,
        save: () => connection,
        remove: async () => undefined
      })
    )
    if (!state) throw new Error('Missing scope')
    const editing = state.startEdit(connection.id)
    state.startAdd()
    finish()
    expect(await editing).toBe(false)
    expect(state.tokenStatus.value).toBe('missing')
  } finally {
    scope.stop()
    mcpConnectionSettings.value.connections = previous
  }
})

test('MCP save and clear failures preserve token input', async () => {
  const scope = effectScope()
  const token = ref('replacement')
  try {
    const state = scope.run(() =>
      useMCPConnectionSettings(token, ref({ bearerTokenRequired: 'Required' }), {
        status: async () => 'configured',
        setCredential: async () => {
          throw new Error('Offline')
        },
        save: () => connection,
        remove: async () => undefined
      })
    )
    if (!state) throw new Error('Missing scope')
    state.draft.value.id = connection.id
    expect(await state.save()).toBe(false)
    expect(state.error.value).toBe('Offline')
    await state.clearCredential()
    expect(state.error.value).toBe('Offline')
    expect(token.value).toBe('replacement')
  } finally {
    scope.stop()
  }
})

test('failed bearer write never enables the saved connection', async () => {
  const scope = effectScope()
  const saved: boolean[] = []
  try {
    const state = scope.run(() =>
      useMCPConnectionSettings(ref('token'), ref({ bearerTokenRequired: 'Required' }), {
        status: async () => 'configured',
        setCredential: async () => {
          throw new Error('Write failed')
        },
        save: (draft) => {
          saved.push(draft.enabled)
          return connection
        },
        remove: async () => undefined
      })
    )
    if (!state) throw new Error('Missing scope')
    state.draft.value.authenticationType = 'bearer'
    state.draft.value.enabled = true
    expect(await state.save()).toBe(false)
    expect(saved).toEqual([false])
  } finally {
    scope.stop()
  }
})

test('clear uses persisted fields rather than invalid unsaved input', async () => {
  const scope = effectScope()
  const names: string[] = []
  try {
    const state = scope.run(() =>
      useMCPConnectionSettings(ref(''), ref({ bearerTokenRequired: 'Required' }), {
        status: async () => 'configured',
        setCredential: async () => undefined,
        save: (draft) => {
          names.push(draft.name)
          expect(draft.url).toBe(connection.transport.url)
          return connection
        },
        remove: async () => undefined
      })
    )
    if (!state) throw new Error('Missing scope')
    state.draft.value.id = connection.id
    state.draft.value.name = ''
    state.draft.value.url = 'invalid'
    await state.clearCredential()
    expect(names).toEqual(['Test'])
  } finally {
    scope.stop()
  }
})

test('status lookup failure opens the editor with an error', async () => {
  const scope = effectScope()
  try {
    const state = scope.run(() =>
      useMCPConnectionSettings(ref(''), ref({ bearerTokenRequired: 'Required' }), {
        status: async () => {
          throw new Error('Locked')
        },
        setCredential: async () => undefined,
        save: () => connection,
        remove: async () => undefined
      })
    )
    if (!state) throw new Error('Missing scope')
    expect(await state.startEdit(connection.id)).toBe(true)
    expect(state.error.value).toBe('Locked')
  } finally {
    scope.stop()
  }
})

test('serializes overlapping credential replacements', async () => {
  const scope = effectScope()
  const writes: string[] = []
  let finish: () => void = () => undefined
  const blocked = new Promise<void>((resolve) => {
    finish = resolve
  })
  const token = ref('first')
  try {
    const state = scope.run(() =>
      useMCPConnectionSettings(token, ref({ bearerTokenRequired: 'Required' }), {
        status: async () => 'configured',
        setCredential: async (_id, value) => {
          writes.push(value)
          if (value === 'first') await blocked
        },
        save: () => connection,
        remove: async () => undefined
      })
    )
    if (!state) throw new Error('Missing scope')
    state.draft.value.id = connection.id
    state.draft.value.authenticationType = 'bearer'
    const first = state.save()
    await Promise.resolve()
    token.value = 'second'
    const second = state.save()
    await Promise.resolve()
    expect(writes).toEqual(['first'])
    finish()
    await Promise.all([first, second])
    expect(writes).toEqual(['first', 'second'])
  } finally {
    finish()
    scope.stop()
  }
})

test('reopened editors serialize writes to the same connection while other connections proceed', async () => {
  const firstScope = effectScope()
  const secondScope = effectScope()
  let finish: () => void = () => undefined
  const blocked = new Promise<void>((resolve) => {
    finish = resolve
  })
  const writes: string[] = []
  const services = {
    status: async () => 'configured' as const,
    setCredential: async (_id: string, value: string) => {
      writes.push(value)
      if (value === 'first') await blocked
    },
    save: (draft: { id: `mcp-${string}` | null }) => ({
      ...connection,
      id: draft.id ?? connection.id
    }),
    remove: async () => undefined
  }
  try {
    const first = firstScope.run(() =>
      useMCPConnectionSettings(ref('first'), ref({ bearerTokenRequired: 'Required' }), services)
    )
    const second = secondScope.run(() =>
      useMCPConnectionSettings(ref('second'), ref({ bearerTokenRequired: 'Required' }), services)
    )
    const other = secondScope.run(() =>
      useMCPConnectionSettings(ref('other'), ref({ bearerTokenRequired: 'Required' }), services)
    )
    if (!first || !second || !other) throw new Error('Missing scope')
    for (const editor of [first, second, other]) {
      editor.draft.value.id = connection.id
      editor.draft.value.authenticationType = 'bearer'
    }
    other.draft.value.id = 'mcp-other'
    const savingFirst = first.save()
    await Promise.resolve()
    firstScope.stop()
    const savingSecond = second.save()
    await other.save()
    expect(writes).toEqual(['first', 'other'])
    finish()
    await Promise.all([savingFirst, savingSecond])
    expect(writes).toEqual(['first', 'other', 'second'])
  } finally {
    finish()
    firstScope.stop()
    secondScope.stop()
  }
})

test('blank-token save rechecks status after a different editor clears the credential', async () => {
  const scope = effectScope()
  let configured = true
  const enabled: boolean[] = []
  const services = {
    status: async () => (configured ? ('configured' as const) : ('missing' as const)),
    setCredential: async (_id: string, value: string) => {
      configured = Boolean(value)
    },
    save: (draft: { enabled: boolean }) => {
      enabled.push(draft.enabled)
      return connection
    },
    remove: async () => undefined
  }
  try {
    const first = scope.run(() =>
      useMCPConnectionSettings(ref(''), ref({ bearerTokenRequired: 'Required' }), services)
    )
    const second = scope.run(() =>
      useMCPConnectionSettings(ref(''), ref({ bearerTokenRequired: 'Required' }), services)
    )
    if (!first || !second) throw new Error('Missing scope')
    await first.startEdit(connection.id)
    await second.startEdit(connection.id)
    second.draft.value.authenticationType = 'bearer'
    second.draft.value.enabled = true
    const clearing = first.clearCredential()
    const saving = second.save()
    await clearing
    expect(await saving).toBe(false)
    expect(second.error.value).toBe('Required')
    expect(enabled).toEqual([false, false])
  } finally {
    scope.stop()
  }
})
