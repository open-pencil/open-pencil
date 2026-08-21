import { createMigratedNodeCloudDatabase } from './bootstrap'

export async function withNodeCloudDatabase<T>(
  operation: (
    database: Awaited<ReturnType<typeof createMigratedNodeCloudDatabase>>['database']
  ) => Promise<T>
): Promise<T> {
  const { database } = await createMigratedNodeCloudDatabase(process.env)
  try {
    return await operation(database)
  } finally {
    await database.destroy()
  }
}
