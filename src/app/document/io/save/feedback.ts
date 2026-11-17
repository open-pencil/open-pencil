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

/** What a failed save says went wrong. */
export const saveErrorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

/** Removes the failure shown for `key`, as a later successful save of it does. */
export function clearSaveFailure(key: object): void {
  const failure = failureToasts.get(key)
  if (failure === undefined) return
  toast.remove(failure)
  failureToasts.delete(key)
}

/**
 * Shows that a save failed until it is retried or a later save of `key` succeeds; a newer failure
 * of the same document takes the place of the one shown. Returns whether one was shown already.
 */
export function showSaveFailure(
  message: string,
  retry: () => void,
  options: SaveFeedbackOptions = {}
): boolean {
  const { key } = options
  const shown = key !== undefined && failureToasts.has(key)
  if (key) clearSaveFailure(key)
  const id = toast.error(
    message,
    {
      label: notificationMessages.get().saveFailedRetry,
      run: (toastId) => {
        toast.remove(toastId)
        if (key) failureToasts.delete(key)
        if (options.isOpen && !options.isOpen()) return
        retry()
      }
    },
    { sticky: true }
  )
  if (key) failureToasts.set(key, id)
  return shown
}

/**
 * Runs a save started by the person and reports a failure where they can see it. Saves started by
 * a room or the automation bridge keep their own error handling; an autosave reports through
 * `useAutosaveFeedback`.
 */
export async function saveWithFeedback(
  save: () => Promise<unknown>,
  options: SaveFeedbackOptions = {}
): Promise<boolean> {
  try {
    const result = await save()
    if (options.key) clearSaveFailure(options.key)
    return result !== false
  } catch (error) {
    showSaveFailure(
      notificationMessages.get().operationFailed({ error: saveErrorText(error) }),
      () => void saveWithFeedback(save, options),
      options
    )
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
