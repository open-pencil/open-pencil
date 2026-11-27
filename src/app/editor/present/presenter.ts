import * as v from 'valibot'
import { onScopeDispose, shallowRef } from 'vue'

import {
  presenterChannelName,
  presenterUpdateSchema,
  type PresenterCommand,
  type PresenterStatus
} from './schema'

/**
 * The presenter's side of a presentation: where it is, as the window presenting it says, and the
 * commands to send it. `ended` is true once that window says so or closes the presentation.
 */
export function usePresenter(presentationId: string) {
  const status = shallowRef<PresenterStatus | null>(null)
  const ended = shallowRef(false)
  const channel = new BroadcastChannel(presenterChannelName(presentationId))

  channel.addEventListener('message', (event: MessageEvent<unknown>) => {
    const parsed = v.safeParse(presenterUpdateSchema, event.data)
    if (!parsed.success) return
    if (parsed.output.type === 'ended') ended.value = true
    else {
      status.value = parsed.output
      ended.value = false
    }
  })

  function send(command: PresenterCommand): void {
    channel.postMessage(command)
  }

  // The presenting window answers with where it is.
  send({ type: 'hello' })
  onScopeDispose(() => channel.close())

  return { status, ended, send }
}
