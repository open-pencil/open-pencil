import * as v from 'valibot'
import { onScopeDispose, watch } from 'vue'

import { slideSettings } from '@open-pencil/scene-graph/slides'

import type { EditorStore } from '@/app/editor/active-store'
import { useSlideThumbnails } from '@/app/editor/slides/thumbnails'

import {
  presenterChannelName,
  presenterCommandSchema,
  type PresenterStatus,
  type PresenterUpdate
} from './schema'

/**
 * Tells a presenter's window, if one is open, where the presentation is, with pictures and notes
 * of the slides, and takes its commands. Lives as long as the presentation's view.
 */
export function usePresenterLink(store: EditorStore): void {
  const thumbnails = useSlideThumbnails(store)
  let channel: BroadcastChannel | null = null

  function notesOf(id: string): string {
    const slide = store.graph.getNode(id)
    return (slide && slideSettings(slide)?.notes) ?? ''
  }

  function status(): PresenterStatus | null {
    const presentation = store.state.presentation
    if (!presentation) return null
    return {
      type: 'status',
      title: store.state.documentName,
      slides: presentation.slideIds.map((id, index) => ({
        id,
        number: index + 1,
        thumbnail: thumbnails.urls.value.get(id) ?? null,
        notes: notesOf(id)
      })),
      index: presentation.index,
      played: presentation.played,
      steps: presentation.steps,
      startedAt: presentation.startedAt
    }
  }

  function post(update: PresenterUpdate | null): void {
    if (update) channel?.postMessage(update)
  }

  function onCommand(event: MessageEvent<unknown>): void {
    const parsed = v.safeParse(presenterCommandSchema, event.data)
    if (!parsed.success) return
    const command = parsed.output
    if (command.type === 'hello') post(status())
    else if (command.type === 'next') store.presentNext()
    else if (command.type === 'previous') store.presentPrevious()
    else if (command.type === 'slide') store.presentSlide(command.index)
    else store.stopPresenting()
  }

  watch(
    () => store.state.presentation?.id,
    (id) => {
      channel?.close()
      channel = id ? new BroadcastChannel(presenterChannelName(id)) : null
      channel?.addEventListener('message', onCommand)
      for (const slideId of store.state.presentation?.slideIds ?? []) thumbnails.want(slideId, true)
    },
    { immediate: true }
  )
  watch([() => store.state.presentation, thumbnails.urls], () => post(status()))

  onScopeDispose(() => {
    post({ type: 'ended' })
    channel?.close()
  })
}
