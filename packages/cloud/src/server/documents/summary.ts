import type { DocumentSummary } from '#cloud/contract'
import type { DocumentDatabase, DocumentSummaryRow } from '#cloud/server/documents/repository'

const SUMMARY_COLUMNS = [
  'id',
  'workspaceId',
  'name',
  'currentRevisionId',
  'version',
  'createdAt',
  'updatedAt'
] as const

function toISOString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value
}

export function documentSummary(row: DocumentSummaryRow): DocumentSummary {
  return {
    ...row,
    createdAt: toISOString(row.createdAt),
    updatedAt: toISOString(row.updatedAt)
  }
}

export async function getDocumentSummaryRow(
  database: DocumentDatabase,
  documentId: string
): Promise<DocumentSummaryRow | undefined> {
  return database
    .selectFrom('document')
    .select(SUMMARY_COLUMNS)
    .where('id', '=', documentId)
    .where('deletedAt', 'is', null)
    .executeTakeFirst()
}
