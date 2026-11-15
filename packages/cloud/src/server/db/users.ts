import type { ExpressionBuilder } from 'kysely'

import type { CloudDatabase } from './tables'

/**
 * `user.id` as text, the form every other table keeps account IDs in, such as a document's
 * `createdBy`, so the two can be compared.
 */
export function userIdText(expression: ExpressionBuilder<CloudDatabase, 'user'>) {
  return expression.cast<string>(expression.ref('user.id'), 'text')
}

/** Whether the user row in scope is banned, by a ban that has not run out. */
export function isBannedNow(expression: ExpressionBuilder<CloudDatabase, 'user'>) {
  return expression.and([
    expression('user.banned', '=', true),
    expression.or([
      expression('user.banExpires', 'is', null),
      expression('user.banExpires', '>', new Date())
    ])
  ])
}
