import { createCloudTestDatabase } from '#cloud-test/helpers/database'

import {
  CLOUD_FEATURE_KEYS,
  createDefaultCloudPolicy,
  createDocumentSharingService,
  EntitlementOpenFeatureProvider,
  StaticEntitlementSource
} from '@open-pencil/cloud/server'

export async function seedSharing() {
  const runtime = await createCloudTestDatabase()
  const workspaceId = crypto.randomUUID()
  const documentId = crypto.randomUUID()
  await runtime.database
    .insertInto('workspace')
    .values({ id: workspaceId, name: 'Design', slug: `design-${workspaceId}`, createdBy: 'owner' })
    .execute()
  await runtime.database
    .insertInto('workspaceMember')
    .values([
      { workspaceId, userId: 'owner', role: 'admin' },
      { workspaceId, userId: 'viewer', role: 'viewer' }
    ])
    .execute()
  await runtime.database
    .insertInto('document')
    .values({ id: documentId, workspaceId, name: 'Homepage', createdBy: 'owner' })
    .execute()
  return { runtime, documentId, sharing: createDocumentSharingService(runtime.database) }
}

export function sharingWithPolicy(
  context: Awaited<ReturnType<typeof seedSharing>>,
  values: Record<string, boolean>,
  deploymentMode: 'official' | 'self-hosted' = 'self-hosted'
) {
  const policy = createDefaultCloudPolicy(
    new EntitlementOpenFeatureProvider(new StaticEntitlementSource(values))
  )
  return createDocumentSharingService(context.runtime.database, { policy, deploymentMode })
}

export async function assignOwnerUser(
  context: Awaited<ReturnType<typeof seedSharing>>,
  input: { id: string; name: string; email: string }
): Promise<void> {
  await context.runtime.database
    .insertInto('user')
    .values({ ...input, emailVerified: true, image: null })
    .execute()
  const workspace = await context.runtime.database
    .selectFrom('document')
    .select('workspaceId')
    .where('id', '=', context.documentId)
    .executeTakeFirstOrThrow()
  await context.runtime.database
    .updateTable('workspaceMember')
    .set({ userId: input.id })
    .where('workspaceId', '=', workspace.workspaceId)
    .where('userId', '=', 'owner')
    .execute()
}

export { CLOUD_FEATURE_KEYS }
