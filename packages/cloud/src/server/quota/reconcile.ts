import type { CloudDatabase } from '#cloud/server/db'
import { sumBy } from 'es-toolkit'
import type { Kysely } from 'kysely'

export type StorageReconciliation = {
  workspaceId: string
  recordedBytes: number
  calculatedBytes: number
  corrected: boolean
}

export function createStorageReconciliationService(database: Kysely<CloudDatabase>) {
  return {
    async reconcile(options: { dryRun: boolean }): Promise<StorageReconciliation[]> {
      const workspaces = await database.selectFrom('workspace').select('id').execute()
      const results: StorageReconciliation[] = []
      for (const workspace of workspaces) {
        const [recorded, objects] = await Promise.all([
          database
            .selectFrom('workspaceStorageUsage')
            .select('committedBytes')
            .where('workspaceId', '=', workspace.id)
            .executeTakeFirst(),
          database
            .selectFrom('storageObject')
            .innerJoin('documentRevision', 'documentRevision.storageObjectId', 'storageObject.id')
            .innerJoin('document', 'document.id', 'documentRevision.documentId')
            .select(['storageObject.id', 'storageObject.byteSize'])
            .distinct()
            .where('document.workspaceId', '=', workspace.id)
            // Images are the workspace's once, whichever revisions use them.
            .union((union) =>
              union
                .selectFrom('storageObject')
                .innerJoin('workspaceImage', 'workspaceImage.storageObjectId', 'storageObject.id')
                .select(['storageObject.id', 'storageObject.byteSize'])
                .where('workspaceImage.workspaceId', '=', workspace.id)
            )
            .execute()
        ])
        const recordedBytes = Number(recorded?.committedBytes ?? 0)
        const calculatedBytes = sumBy(objects, (object) => Number(object.byteSize))
        const corrected = recordedBytes !== calculatedBytes
        if (corrected && !options.dryRun) {
          await database
            .insertInto('workspaceStorageUsage')
            .values({ workspaceId: workspace.id, committedBytes: calculatedBytes })
            .onConflict((conflict) =>
              conflict.column('workspaceId').doUpdateSet({
                committedBytes: calculatedBytes,
                updatedAt: new Date()
              })
            )
            .execute()
        }
        results.push({ workspaceId: workspace.id, recordedBytes, calculatedBytes, corrected })
      }
      return results
    }
  }
}
