import { openDB, type DBSchema, type IDBPDatabase, type OpenDBCallbacks } from 'idb'

export type AppDatabaseDefinition<Database extends DBSchema> = {
  name: string
  version: number
  callbacks: OpenDBCallbacks<Database>
}

/** Keep database definitions explicit and colocated with their feature schema. */
export function defineAppDatabase<Database extends DBSchema>(
  definition: AppDatabaseDefinition<Database>
): AppDatabaseDefinition<Database> {
  return definition
}

/** Open a typed app database through the shared IndexedDB boundary. */
export function openAppDatabase<Database extends DBSchema>(
  definition: AppDatabaseDefinition<Database>
): Promise<IDBPDatabase<Database>> {
  return openDB(definition.name, definition.version, definition.callbacks)
}
