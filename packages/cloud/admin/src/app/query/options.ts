import { cloudAdminAPI } from '#admin/api/client'
import { queryOptions } from '@tanstack/vue-query'

import { discoverCloud, createCloudAPIClient } from '@open-pencil/cloud/client'

import { cloudQueryKeys } from './keys'

export const discoveryQueryOptions = () =>
  queryOptions({
    queryKey: cloudQueryKeys.discovery,
    queryFn: ({ signal }) => discoverCloud(globalThis.location.origin, { signal }),
    staleTime: 'static' as const
  })

export const accountQueryOptions = () =>
  queryOptions({
    queryKey: cloudQueryKeys.account,
    queryFn: ({ signal }) => cloudAdminAPI.accountStatus(signal),
    staleTime: 15_000,
    retry: false
  })

export const authenticationMethodsQueryOptions = () =>
  queryOptions({
    queryKey: cloudQueryKeys.authenticationMethods,
    queryFn: ({ signal }) => cloudAdminAPI.authenticationMethods(signal)
  })

export const workspacesQueryOptions = () =>
  queryOptions({
    queryKey: cloudQueryKeys.workspaces,
    queryFn: async ({ signal }) => {
      const discovery = await discoverCloud(globalThis.location.origin, { signal })
      return createCloudAPIClient(discovery.apiURL, { signal }).listWorkspaces()
    }
  })

export const sessionQueryOptions = () =>
  queryOptions({
    queryKey: cloudQueryKeys.session,
    queryFn: ({ signal }) => cloudAdminAPI.session(signal),
    staleTime: 15_000,
    retry: false
  })

export const enrollmentQueryOptions = (status: string) =>
  queryOptions({
    queryKey: cloudQueryKeys.enrollments.list(status),
    queryFn: ({ signal }) => cloudAdminAPI.enrollments(status || undefined, signal)
  })

export const usersQueryOptions = (search: string) =>
  queryOptions({
    queryKey: cloudQueryKeys.users(search),
    queryFn: ({ signal }) => cloudAdminAPI.users(search || undefined, signal)
  })

export const emailQueryOptions = () =>
  queryOptions({
    queryKey: cloudQueryKeys.email,
    queryFn: ({ signal }) => cloudAdminAPI.email(signal)
  })

export const auditQueryOptions = () =>
  queryOptions({
    queryKey: cloudQueryKeys.audit,
    queryFn: ({ signal }) => cloudAdminAPI.audit(signal)
  })

export const operationsQueryOptions = () =>
  queryOptions({
    queryKey: cloudQueryKeys.operations,
    queryFn: ({ signal }) => cloudAdminAPI.operations(signal)
  })
