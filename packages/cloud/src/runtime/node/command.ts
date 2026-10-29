import { createMigratedNodeCloudDatabase } from './bootstrap'

type MigratedNodeCloudDatabase = Awaited<ReturnType<typeof createMigratedNodeCloudDatabase>>

export async function withNodeCloudDatabase<T>(
  operation: (
    database: MigratedNodeCloudDatabase['database'],
    config: MigratedNodeCloudDatabase['config']
  ) => Promise<T>
): Promise<T> {
  const { config, database } = await createMigratedNodeCloudDatabase(process.env)
  try {
    return await operation(database, config)
  } finally {
    await database.destroy()
  }
}
