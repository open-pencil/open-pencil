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

/** Documents whose current run of failures already sent its system notification. */
const noticedFailures = new WeakSet<object>()

function removeFailureToast(key: object): void {
  const failure = failureToasts.get(key)
  if (failure === undefined) return
  toast.remove(failure)
  failureToasts.delete(key)
}

/** Removes the failure shown for `key`, as a later successful save of it does, ending its run. */
export function clearSaveFailure(key: object): void {
  removeFailureToast(key)
  noticedFailures.delete(key)
}

/**
 * Whether this failure of `key` is the first of its run to claim a system notification. A run
 * goes on while newer failures replace the one shown, and ends once a save or closing clears it.
 */
export function claimFailureNotice(key: object): boolean {
  if (noticedFailures.has(key)) return false
  noticedFailures.add(key)
  return true
}

/** Documents whose retry is still saving, so another click waits for it rather than racing it. */
const retrying = new WeakSet<object>()

/**
 * Shows that a save failed until it is retried or a later save of `key` succeeds; a newer failure
 * of the same document takes the place of the one shown. Returns whether one was shown already.
 */
export function showSaveFailure(
  message: string,
  retry: () => Promise<unknown>,
  options: SaveFeedbackOptions = {}
): boolean {
  const { key } = options
  const shown = key !== undefined && failureToasts.has(key)
  if (key) removeFailureToast(key)
  const id = toast.error(
    message,
    {
      label: notificationMessages.get().saveFailedRetry,
      run: (toastId) => {
        const open = !options.isOpen || options.isOpen()
        if (!key || !open) {
          toast.remove(toastId)
          if (key) clearSaveFailure(key)
          if (open) void retry()
          return
        }
        // A document's failure stays while its retry runs: a save clears it, a failure replaces
        // it, and a save that does not happen, such as a dismissed file picker, leaves it.
        if (retrying.has(key)) return
        retrying.add(key)
        void retry().finally(() => retrying.delete(key))
      }
    },
    // Each document's failure is its own, so another document's save never clears it.
    { sticky: true, separate: key !== undefined }
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
    const saved = (await save()) !== false
    // A save that did not happen, such as a dismissed file picker, leaves the failure shown.
    if (saved && options.key) clearSaveFailure(options.key)
    return saved
  } catch (error) {
    // A save that fails after its tab closed has nothing left to retry.
    if (options.isOpen && !options.isOpen()) return false
    showSaveFailure(
      notificationMessages.get().operationFailed({ error: saveErrorText(error) }),
      () => saveWithFeedback(save, options),
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
