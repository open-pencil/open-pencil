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

/** A typed app database whose connection is opened again once the browser closes it. */
export interface AppDatabase<Database extends DBSchema> {
  /** An open connection: the one in use while it still takes transactions, or a new one. */
  open(): Promise<IDBPDatabase<Database>>
  /** Close the live connection and forget it; a later `open` connects again. */
  close(): Promise<void>
}

/**
 * Whether a connection still takes transactions. A browser can close one without telling the
 * page, as WebKit does when it suspends a page; every transaction then throws InvalidStateError
 * ("The database connection is closing").
 */
function takesTransactions<Database extends DBSchema>(database: IDBPDatabase<Database>): boolean {
  const [store] = database.objectStoreNames
  if (!store) return true
  try {
    database.transaction(store)
    return true
  } catch (error) {
    if (error instanceof DOMException && error.name === 'InvalidStateError') return false
    throw error
  }
}

/**
 * Connect to a typed app database through the shared IndexedDB boundary. The connection opens on
 * first use and is kept until it stops taking transactions because the browser closed it; the
 * next `open` then connects again. It stays open when another tab needs a newer version: this
 * tab's code cannot reconnect at its older one.
 */
export function connectAppDatabase<Database extends DBSchema>(
  definition: AppDatabaseDefinition<Database>
): AppDatabase<Database> {
  let connection: Promise<IDBPDatabase<Database>> | undefined
  const drop = (closed: Promise<IDBPDatabase<Database>>) => {
    if (connection === closed) connection = undefined
  }
  const connect = (): Promise<IDBPDatabase<Database>> => {
    const opening: Promise<IDBPDatabase<Database>> = openDB(definition.name, definition.version, {
      ...definition.callbacks,
      terminated() {
        drop(opening)
        definition.callbacks.terminated?.()
      }
    })
    connection = opening
    opening.catch(() => drop(opening))
    return opening
  }
  return {
    async open() {
      const current = connection ?? connect()
      const database = await current
      if (takesTransactions(database)) return database
      drop(current)
      return connection ?? connect()
    },
    async close() {
      const current = connection
      connection = undefined
      if (current) {
        const database = await current.catch(() => undefined)
        database?.close()
      }
    }
  }
}

/** Delete an app database by name. Callers close their connections first. */
export function deleteAppDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error(`Failed to delete ${name}`))
    request.onblocked = () => reject(new Error(`Deleting ${name} is blocked by an open connection`))
  })
}
