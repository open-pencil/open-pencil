import 'fake-indexeddb/auto'
import { expect, test } from 'bun:test'

import type { DBSchema } from 'idb'

import {
  AppDatabaseClosedError,
  connectAppDatabase,
  defineAppDatabase,
  deleteAppDatabase
} from '@/app/storage/idb'

interface NotesDatabase extends DBSchema {
  notes: { key: string; value: string }
}

function notesDatabase(name: string) {
  return defineAppDatabase<NotesDatabase>({
    name,
    version: 1,
    callbacks: {
      upgrade(database) {
        database.createObjectStore('notes')
      }
    }
  })
}

test('the same connection serves every use while it is open', async () => {
  const database = connectAppDatabase(notesDatabase('reuse'))
  expect(await database.open()).toBe(await database.open())
})

test('a connection the browser closed is replaced on the next use', async () => {
  const database = connectAppDatabase(notesDatabase('reconnect'))
  const first = await database.open()
  await first.put('notes', 'kept', 'a')
  // As WebKit does when it suspends a page: the page is not told, every transaction is refused.
  first.close()
  expect(() => first.transaction('notes')).toThrow(
    expect.objectContaining({ name: 'InvalidStateError' })
  )

  const second = await database.open()
  expect(second).not.toBe(first)
  expect(await second.get('notes', 'a')).toBe('kept')
  await second.put('notes', 'written', 'b')
  expect(await second.get('notes', 'b')).toBe('written')
})

test('closing is terminal: a use after close rejects instead of connecting again', async () => {
  const database = connectAppDatabase(notesDatabase('close-terminal'))
  await database.open()
  await database.close()

  await expect(database.open()).rejects.toBeInstanceOf(AppDatabaseClosedError)
  // No connection outlived the close, so the database deletes without blocking.
  await expect(deleteAppDatabase('close-terminal')).resolves.toBeUndefined()
})

test('closing retires a database that was never opened, without opening it', async () => {
  const database = connectAppDatabase(notesDatabase('close-never-opened'))
  await database.close()

  await expect(database.open()).rejects.toBeInstanceOf(AppDatabaseClosedError)
})

test('closing twice joins the same close', async () => {
  const database = connectAppDatabase(notesDatabase('close-twice'))
  await database.open()

  await expect(Promise.all([database.close(), database.close()])).resolves.toBeDefined()
  await expect(database.open()).rejects.toBeInstanceOf(AppDatabaseClosedError)
  await expect(deleteAppDatabase('close-twice')).resolves.toBeUndefined()
})

test('an open in flight when close starts settles as closed, not as a leaked connection', async () => {
  const database = connectAppDatabase(notesDatabase('close-in-flight'))
  const opening = database.open()
  const closing = database.close()

  await expect(opening).rejects.toBeInstanceOf(AppDatabaseClosedError)
  await closing
  await expect(deleteAppDatabase('close-in-flight')).resolves.toBeUndefined()
})

test('an open that starts inside the close window never connects', async () => {
  const database = connectAppDatabase(notesDatabase('close-window'))
  await database.open()
  const closing = database.close()
  const late = database.open()

  await expect(late).rejects.toBeInstanceOf(AppDatabaseClosedError)
  await closing
  await expect(deleteAppDatabase('close-window')).resolves.toBeUndefined()
})
