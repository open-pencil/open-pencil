import { describe, expect, test } from 'bun:test'

import { finishAfterResponse } from '#cloud/runtime/cloudflare/response'

const encoder = new TextEncoder()

/** A body whose chunks the test sends, as a handler streams a result after it returned. */
function streamed() {
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined
  const body = new ReadableStream<Uint8Array>({
    start(started) {
      controller = started
    }
  })
  return {
    response: new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    send: (text: string) => controller?.enqueue(encoder.encode(text)),
    end: () => controller?.close()
  }
}

describe('finishAfterResponse', () => {
  test('keeps the services open until a streamed body is sent', async () => {
    let finished = false
    const { response, send, end } = streamed()
    const answered = finishAfterResponse(response, () => {
      finished = true
    })
    expect(answered.status).toBe(200)
    expect(answered.headers.get('content-type')).toBe('text/event-stream')
    const text = answered.text()
    send('data: result')
    await Bun.sleep(0)
    expect(finished).toBe(false)
    end()
    expect(await text).toBe('data: result')
    await Bun.sleep(0)
    expect(finished).toBe(true)
  })

  test('finishes once a client stops reading', async () => {
    let finished = false
    const { response, send } = streamed()
    const answered = finishAfterResponse(response, () => {
      finished = true
    })
    send('data: partial')
    await answered.body?.cancel()
    await Bun.sleep(0)
    expect(finished).toBe(true)
  })

  test('finishes at once when there is no body to send', () => {
    let finished = false
    finishAfterResponse(new Response(null, { status: 204 }), () => {
      finished = true
    })
    expect(finished).toBe(true)
  })
})
