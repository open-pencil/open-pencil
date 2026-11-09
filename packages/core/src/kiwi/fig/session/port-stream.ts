/**
 * A byte stream carried over a `MessagePort` of its own, for engines that cannot transfer a
 * `ReadableStream` itself, as WebKit cannot. The reading side asks for each chunk, so one chunk
 * at most is in flight and the writing side never runs ahead of where the bytes go.
 */
type PortStreamRequest = { type: 'pull' } | { type: 'cancel' }

type PortStreamResponse =
  | { type: 'chunk'; bytes: Uint8Array }
  | { type: 'done' }
  | { type: 'error'; message: string }

/** Serves `stream` to the `receiveStream` at the other end of `port`. */
export function sendStream(stream: ReadableStream<Uint8Array>, port: MessagePort): void {
  const reader = stream.getReader()
  const answer = (message: PortStreamResponse, transfer: Transferable[] = []) =>
    port.postMessage(message, transfer)
  port.onmessage = async (event: MessageEvent<PortStreamRequest>) => {
    if (event.data.type === 'cancel') {
      port.close()
      await reader.cancel()
      return
    }
    try {
      const next = await reader.read()
      if (next.done) {
        answer({ type: 'done' })
        port.close()
        return
      }
      // A chunk may be a view of bytes the writer keeps, such as an archive's images: send a copy.
      const bytes = next.value.slice()
      answer({ type: 'chunk', bytes }, [bytes.buffer])
    } catch (error) {
      answer({ type: 'error', message: error instanceof Error ? error.message : String(error) })
      port.close()
    }
  }
}

/**
 * The stream `sendStream` serves at the other end of `port`. Aborting `signal`, as when the
 * writing side's worker stops, fails the stream rather than leaving its reader waiting.
 */
export function receiveStream(port: MessagePort, signal?: AbortSignal): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>(
    {
      pull: (controller) =>
        new Promise<void>((resolve) => {
          const stop = () => {
            port.close()
            controller.error(signal?.reason)
            resolve()
          }
          if (signal?.aborted) {
            stop()
            return
          }
          signal?.addEventListener('abort', stop, { once: true })
          port.onmessage = (event: MessageEvent<PortStreamResponse>) => {
            signal?.removeEventListener('abort', stop)
            const message = event.data
            if (message.type === 'chunk') controller.enqueue(message.bytes)
            else {
              port.close()
              if (message.type === 'done') controller.close()
              else controller.error(new Error(message.message))
            }
            resolve()
          }
          port.postMessage({ type: 'pull' } satisfies PortStreamRequest)
        }),
      cancel: () => {
        port.postMessage({ type: 'cancel' } satisfies PortStreamRequest)
        port.close()
      }
    },
    { highWaterMark: 0 }
  )
}
