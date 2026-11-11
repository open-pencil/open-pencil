import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

import { openCloudDocumentRoom } from '@/app/cloud/rooms/live'
import { createEditorStore, type EditorStore } from '@/app/editor/session'

import { startTestRelay } from '#tests/helpers/collab/relay-server'

export type Relay = Awaited<ReturnType<typeof startTestRelay>>

type RoomOptions = Parameters<typeof openCloudDocumentRoom>[1]

/** What a test opened, undone in reverse once it ends; `runCleanups` belongs in `afterEach`. */
export const cleanups: (() => Promise<void> | void)[] = []

/** Undoes what the finished test opened, last first. */
export async function runCleanups() {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
}

/** Waits until `condition` holds, polling every 2 ms, and fails after `attempts` polls. */
export async function until(condition: () => boolean, attempts = 500): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (condition()) return
    await new Promise((resolve) => {
      setTimeout(resolve, 2)
    })
  }
  throw new Error('Condition was not met')
}

/** A Cloud relay that stops once the test ends. */
export async function startRelay() {
  const relay = await startTestRelay()
  cleanups.push(() => relay.close())
  return relay
}

/** The room of a Cloud document at its first epoch. */
export const cloudRoomId = (documentId: string) => `cloud:${documentId}:0`

/**
 * Opens `store`'s Cloud document room through `relay` as a signed-in `name`, editing unless
 * `permission` says otherwise; the caller closes it.
 */
export function joinRoom(
  relay: Relay,
  store: EditorStore,
  {
    documentId,
    name,
    permission = 'edit',
    ...options
  }: Omit<RoomOptions, 'roomId' | 'transport' | 'permission'> & {
    documentId: string
    name: string
    permission?: RoomOptions['permission']
  }
) {
  return openCloudDocumentRoom(store, {
    roomId: cloudRoomId(documentId),
    transport: relay.join(documentId, name, permission, 'user'),
    permission,
    ...options
  })
}

/** Leaves `room` once the test ends. */
export function closeAfterTest(room: ReturnType<typeof openCloudDocumentRoom>) {
  cleanups.push(() => {
    room.stop()
    room.session.dispose()
  })
}

/** `joinRoom`, left once the test ends. */
export function openRoom(
  relay: Relay,
  store: EditorStore,
  options: Parameters<typeof joinRoom>[2]
) {
  const room = joinRoom(relay, store, options)
  closeAfterTest(room)
  return room
}

/** Tabs that each opened the same stored file, which gives each its own root. */
export async function openedCopies(count: number) {
  await initCodec()
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  if (!page) throw new Error('Expected a page')
  graph.createNode('RECTANGLE', page.id, { name: 'Card' })
  const bytes = await exportFigFile(graph)
  const stores = []
  for (let index = 0; index < count; index++) {
    const store = createEditorStore(await parseFigFile(Uint8Array.from(bytes).buffer))
    cleanups.push(() => store.preparationController.dispose())
    stores.push(store)
  }
  return stores
}

/** Two tabs that opened the same stored file. */
export async function openedTwice() {
  const [first, second] = await openedCopies(2)
  if (!first || !second) throw new Error('Expected two tabs')
  return [first, second] as const
}
