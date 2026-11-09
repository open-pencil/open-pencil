import { notificationMessages } from '@/app/i18n/notifications'
import { toast, type ToastHandle } from '@/app/shell/ui'
import { formatBytes } from '@/components/ui/feedback/progress'

/** How long a save runs before its progress shows, so quick saves never flash a toast. */
const SAVE_PROGRESS_DELAY_MS = 1000

/** What a failure belongs to, so a retry reaches the same document and a newer save can clear it. */
export interface SaveFeedbackOptions {
  /** Identifies the document; a later successful save of it removes its failure. */
  key?: object
  /** Whether the document is still open, checked before retrying. */
  isOpen?: () => boolean
}

const failureToasts = new WeakMap<object, number>()

/**
 * Runs a save started by the person and reports a failure where they can see it. Saves started by
 * a room, an autosave, or the automation bridge keep their own error handling.
 */
export async function saveWithFeedback(
  save: () => Promise<unknown>,
  options: SaveFeedbackOptions = {}
): Promise<boolean> {
  try {
    const result = await save()
    if (options.key) {
      const failure = failureToasts.get(options.key)
      if (failure !== undefined) {
        toast.remove(failure)
        failureToasts.delete(options.key)
      }
    }
    return result !== false
  } catch (error) {
    const messages = notificationMessages.get()
    const id = toast.error(
      messages.operationFailed({ error: error instanceof Error ? error.message : String(error) }),
      {
        label: messages.saveFailedRetry,
        run: (toastId) => {
          toast.remove(toastId)
          if (options.key) failureToasts.delete(options.key)
          if (options.isOpen && !options.isOpen()) return
          void saveWithFeedback(save, options)
        }
      },
      { sticky: true }
    )
    if (options.key) failureToasts.set(options.key, id)
    return false
  }
}

/** A save in progress: the bytes it has written, shown once it takes long enough to notice. */
export interface SaveProgress {
  /** `stream` with its bytes counted as they are written. */
  track(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array>
  /** The save finished or failed: the toast, if one showed, goes. */
  end(): void
}

export function startSaveProgress(): SaveProgress {
  let written = 0
  let shown: ToastHandle | null = null
  const label = () => formatBytes(written)
  const timer = setTimeout(() => {
    shown = toast.startProgress(notificationMessages.get().savingDocument, {
      progressLabel: label()
    })
  }, SAVE_PROGRESS_DELAY_MS)
  return {
    track: (stream) =>
      stream.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            written += chunk.byteLength
            shown?.update({ progressLabel: label() })
            controller.enqueue(chunk)
          }
        })
      ),
    end() {
      clearTimeout(timer)
      shown?.dismiss()
    }
  }
}
