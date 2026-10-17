import type { CloudDatabase } from '#cloud/server/db'
import type { ExpressionBuilder } from 'kysely'

/** No revision refers to the stored file any more, so it can leave the object store. */
export function unreferencedObject(expression: ExpressionBuilder<CloudDatabase, 'storageObject'>) {
  return expression.not(
    expression.exists(
      expression
        .selectFrom('documentRevision')
        .select('documentRevision.id')
        .whereRef('documentRevision.storageObjectId', '=', 'storageObject.id')
    )
  )
}
