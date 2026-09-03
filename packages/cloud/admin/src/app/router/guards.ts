import { CloudAdminAPIError } from '#admin/api/client'
import { queryClient } from '#admin/app/query/client'
import { accountQueryOptions } from '#admin/app/query/options'
import type { NavigationGuard } from 'vue-router'

function signInRedirect(path: string) {
  return { name: 'sign-in', query: { redirect: path } }
}

async function activeAccountDestination(path: string) {
  try {
    const account = await queryClient.ensureQueryData(accountQueryOptions())
    if (account.state === 'active') return true
    return { name: `account-${account.state}` }
  } catch (error) {
    if (error instanceof CloudAdminAPIError && error.kind === 'authentication-required') {
      return signInRedirect(path)
    }
    throw error
  }
}

export const resolveAnonymous: NavigationGuard = async () => {
  try {
    const account = await queryClient.ensureQueryData(accountQueryOptions())
    if (account.state === 'active') return { name: 'dashboard' }
    return { name: `account-${account.state}` }
  } catch (error) {
    if (error instanceof CloudAdminAPIError && error.kind === 'authentication-required') return true
    throw error
  }
}

export function requireAccountState(
  expectedState: 'pending' | 'rejected' | 'revoked'
): NavigationGuard {
  return async () => {
    try {
      const account = await queryClient.ensureQueryData(accountQueryOptions())
      if (account.state === expectedState) return true
      if (account.state === 'active') return { name: 'dashboard' }
      return { name: `account-${account.state}` }
    } catch (error) {
      if (error instanceof CloudAdminAPIError && error.kind === 'authentication-required') {
        return { name: 'sign-in' }
      }
      throw error
    }
  }
}

export const requireActiveAccount: NavigationGuard = (to) => activeAccountDestination(to.fullPath)

export const requireDeploymentAdmin: NavigationGuard = async (to) => {
  const active = await activeAccountDestination(to.fullPath)
  if (active !== true) return active
  const account = await queryClient.ensureQueryData(accountQueryOptions())
  return account.user.deploymentRole === 'admin' ? true : { name: 'admin-forbidden' }
}
