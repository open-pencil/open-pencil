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

/** A use of a database after it was closed: closing is terminal and never connects again. */
export class AppDatabaseClosedError extends Error {
  override readonly name = 'AppDatabaseClosedError'

  constructor(databaseName: string) {
    super(`Database ${databaseName} is closed`)
  }
}

/** A typed app database whose connection is opened again once the browser closes it. */
export interface AppDatabase<Database extends DBSchema> {
  /** An open connection: the one in use while it still takes transactions, or a new one. */
  open(): Promise<IDBPDatabase<Database>>
  /** Retire the database: the live connection closes and every later `open` rejects. */
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
 *
 * `close()` is terminal: the database is retired, never forgotten-and-reopened. A connection that
 * outlives its owner blocks `deleteDatabase` and leaks, and no caller has a use for a retired
 * database — a new identity is a new handle. An `open` already holding the connection settles on
 * IndexedDB's own close semantics, and one still waiting for it — or starting inside the close
 * window — rejects with `AppDatabaseClosedError` rather than connecting behind the close.
 */
export function connectAppDatabase<Database extends DBSchema>(
  definition: AppDatabaseDefinition<Database>
): AppDatabase<Database> {
  let connection: Promise<IDBPDatabase<Database>> | undefined
  /** The shared close, or `undefined` while the database still lives. Truthy marks it retired. */
  let closing: Promise<void> | undefined
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
  // Through a function so a check after an `await` is not narrowed away: `close()` mutates
  // `closing` concurrently, which control-flow analysis cannot see.
  const retired = (): boolean => closing !== undefined
  const refuseIfRetired = () => {
    if (retired()) throw new AppDatabaseClosedError(definition.name)
  }
  return {
    async open() {
      for (;;) {
        refuseIfRetired()
        const current = connection ?? connect()
        const database = await current
        // A close that started while this connection was being awaited owns it: handing the
        // handle out now, or connecting again, would leak a connection nobody closes.
        refuseIfRetired()
        if (takesTransactions(database)) return database
        drop(current)
      }
    },
    close() {
      // `closing` is assigned synchronously, so an `open` in any later microtask — even one
      // already inside the close window — sees the database retired before it can connect.
      closing ??= (async () => {
        const current = connection
        connection = undefined
        const database = await current?.catch(() => undefined)
        database?.close()
      })()
      return closing
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
