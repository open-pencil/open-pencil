import { expect, test } from 'bun:test'

import { queryClient } from '#admin/app/query/client'
import { accountQueryOptions } from '#admin/app/query/options'
import { requireAccountState, resolveAnonymous } from '#admin/app/router/guards'
import { createMemoryHistory, createRouter } from 'vue-router'

function router() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/auth/sign-in', name: 'sign-in', component: {}, beforeEnter: resolveAnonymous },
      {
        path: '/account/pending',
        name: 'account-pending',
        component: {},
        beforeEnter: requireAccountState('pending')
      },
      { path: '/cloud/device', component: {} },
      { path: '/app', component: {} }
    ]
  })
}

test('signed-in account resumes device approval rather than dashboard', async () => {
  queryClient.setQueryData(accountQueryOptions().queryKey, {
    state: 'active',
    user: { userId: 'test-user', email: 'test@example.com', name: 'Test user' }
  })
  try {
    const navigation = router()
    await navigation.push('/auth/sign-in?redirect=%2Fcloud%2Fdevice%3Fuser_code%3DABCD')
    expect(navigation.currentRoute.value.fullPath).toBe('/cloud/device?user_code=ABCD')
  } finally {
    queryClient.clear()
  }
})

test('pending enrollment retains destination and resumes after approval', async () => {
  queryClient.setQueryData(accountQueryOptions().queryKey, {
    state: 'pending',
    user: { userId: 'test-user', email: 'test@example.com', name: 'Test user' }
  })
  try {
    const navigation = router()
    await navigation.push('/auth/sign-in?redirect=%2Fcloud%2Fdevice%3Fuser_code%3DABCD')
    expect(navigation.currentRoute.value.name).toBe('account-pending')
    expect(navigation.currentRoute.value.query.redirect).toBe('/cloud/device?user_code=ABCD')
    queryClient.setQueryData(accountQueryOptions().queryKey, {
      state: 'active',
      user: { userId: 'test-user', email: 'test@example.com', name: 'Test user' }
    })
    const reloaded = router()
    await reloaded.push(navigation.currentRoute.value.fullPath)
    expect(reloaded.currentRoute.value.fullPath).toBe('/cloud/device?user_code=ABCD')
  } finally {
    queryClient.clear()
  }
})
