import { expect, test } from 'bun:test'

import { effectScope, nextTick, ref } from 'vue'

import type { ToolDescriptor } from '@open-pencil/mcp/tools'

import { useToolAccess } from '@/app/automation/tool-access/settings/list'

function catalog() {
  return ref<ToolDescriptor[]>([
    {
      name: 'inspect_a',
      description: 'Inspect layers',
      effect: 'read',
      availability: 'default',
      capabilities: ['document:read'],
      enabled: true
    },
    {
      name: 'inspect_b',
      description: 'Inspect variables',
      effect: 'read',
      availability: 'default',
      capabilities: ['document:read'],
      enabled: true
    },
    {
      name: 'edit_a',
      description: 'Change a layer',
      effect: 'write',
      availability: 'default',
      capabilities: ['document:write'],
      enabled: true
    }
  ])
}

test('tool counts and mixed states follow the controlled model and catalog', () => {
  const tools = catalog()
  const disabled = ref(['inspect_a', 'unavailable_tool'])
  const access = useToolAccess(tools, disabled)
  expect(access.enabledCount.value).toBe(2)
  expect(access.inspectionEnabled.value).toBe(true)
  expect(access.inspectionState.value).toBe('mixed')
  access.inspectionEnabled.value = false
  expect(disabled.value).toEqual(['inspect_a', 'unavailable_tool', 'inspect_b'])
  expect(access.enabledCount.value).toBe(1)
  expect(access.inspectionState.value).toBe('idle')
  access.inspectionEnabled.value = true
  expect(disabled.value).toEqual(['unavailable_tool'])
  access.setToolEnabled('edit_a', false)
  expect(access.modificationEnabled.value).toBe(false)
  disabled.value = []
  expect(access.enabledCount.value).toBe(3)
  tools.value = []
  expect(access.enabledCount.value).toBe(0)
  expect(access.inspectionEnabled.value).toBe(false)
})

test('search filters presentation without changing category membership or access', () => {
  const tools = catalog()
  const disabled = ref<string[]>([])
  const access = useToolAccess(tools, disabled)
  access.search.value = '  VARIABLES '
  expect(access.visibleTools.value.map((tool) => tool.name)).toEqual(['inspect_b'])
  access.inspectionEnabled.value = false
  expect(disabled.value).toEqual(['inspect_a', 'inspect_b'])
  expect(access.enabledCount.value).toBe(1)
  access.search.value = 'no-match'
  expect(access.visibleTools.value).toEqual([])
})

test('groups project filtered tools and search reopens collapsed groups', async () => {
  const scope = effectScope()
  try {
    const access = scope.run(() => useToolAccess(catalog(), ref<string[]>([])))
    if (!access) throw new Error('Missing tool-access scope')
    expect(access.groups.value.map((group) => [group.effect, group.tools.length])).toEqual([
      ['read', 2],
      ['write', 1]
    ])
    access.expanded.value = { read: false, write: false }
    access.search.value = 'variables'
    await nextTick()
    expect(access.expanded.value).toEqual({ read: true, write: true })
    expect(access.groups.value[0]?.tools.map((tool) => tool.name)).toEqual(['inspect_b'])
    access.setGroupEnabled('read', false)
    expect(access.enabledCount.value).toBe(1)
  } finally {
    scope.stop()
  }
})
