import type { CloudDatabase } from '#cloud/server/db'
import type { ExpressionBuilder } from 'kysely'

/**
 * No revision refers to the stored file any more, and no workspace keeps it as an image, so it
 * can leave the object store.
 */
export function unreferencedObject(expression: ExpressionBuilder<CloudDatabase, 'storageObject'>) {
  return expression.and([
    expression.not(
      expression.exists(
        expression
          .selectFrom('documentRevision')
          .select('documentRevision.id')
          .whereRef('documentRevision.storageObjectId', '=', 'storageObject.id')
      )
    ),
    expression.not(
      expression.exists(
        expression
          .selectFrom('workspaceImage')
          .select('workspaceImage.checksum')
          .whereRef('workspaceImage.storageObjectId', '=', 'storageObject.id')
      )
    )
  ])
}
