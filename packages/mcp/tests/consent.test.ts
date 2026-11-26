import { describe, expect, test } from 'bun:test'
import { createInterface } from 'node:readline'
import { PassThrough } from 'node:stream'

import * as v from 'valibot'

import { stdioPathConsent, type PathConsentRequest } from '#mcp/consent'

const questionSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.strictObject({
    type: v.literal('consent'),
    id: v.number(),
    tool: v.string(),
    access: v.picklist(['read', 'write']),
    path: v.string(),
    client: v.optional(v.string())
  })
)

type Question = v.InferOutput<typeof questionSchema>

/** A consent over a pair of streams, standing in for the desktop app on the other end. */
function desktop() {
  const input = new PassThrough()
  const output = new PassThrough()
  const consent = stdioPathConsent(input, output)
  const lines: string[] = []
  const waiters: (() => void)[] = []
  createInterface({ input: output }).on('line', (line) => {
    lines.push(line)
    for (const wake of waiters.splice(0)) wake()
  })
  /** The `index`-th question the server writes, once it has. */
  async function question(index: number): Promise<Question> {
    if (lines.length > index) return v.parse(questionSchema, lines[index])
    await new Promise<void>((resolve) => {
      waiters.push(resolve)
    })
    return question(index)
  }
  return {
    consent,
    question,
    /** Every question the server wrote so far. */
    asked: () => lines.map((line) => v.parse(questionSchema, line)),
    answer(id: number, allowed: boolean) {
      input.write(`${JSON.stringify({ type: 'consent', id, allowed })}\n`)
    },
    send(line: string) {
      input.write(`${line}\n`)
    },
    close() {
      input.end()
    }
  }
}

/** Lets stream and readline callbacks that are already queued run. */
function settle() {
  return new Promise<void>((resolve) => {
    setImmediate(resolve)
  })
}

function request(access: PathConsentRequest['access'], path: string): PathConsentRequest {
  return { tool: 'save_document', access, path, client: 'claude-code' }
}

describe('stdioPathConsent', () => {
  test('asks the other end with the request and resolves once it allows', async () => {
    const app = desktop()
    const pending = app.consent(request('write', '/root/a.fig'))

    const question = await app.question(0)
    expect(question).toEqual({
      type: 'consent',
      id: question.id,
      tool: 'save_document',
      access: 'write',
      path: '/root/a.fig',
      client: 'claude-code'
    })
    app.answer(question.id, true)
    await expect(pending).resolves.toBeUndefined()
  })

  test('throws once the other end refuses, and asks again next time', async () => {
    const app = desktop()
    const refused = app.consent(request('read', '/root/photo.png'))
    app.answer((await app.question(0)).id, false)
    await expect(refused).rejects.toThrow('/root/photo.png')

    const again = app.consent(request('read', '/root/photo.png'))
    const second = await app.question(1)
    expect(second.path).toBe('/root/photo.png')
    app.answer(second.id, true)
    await expect(again).resolves.toBeUndefined()
  })

  test('remembers an allowed path and access without asking again', async () => {
    const app = desktop()
    const first = app.consent(request('read', '/root/photo.png'))
    app.answer((await app.question(0)).id, true)
    await first

    await app.consent(request('read', '/root/photo.png'))
    await settle()
    expect(app.asked()).toHaveLength(1)
  })

  test('lets an allowed write cover later reads of that path, but not a read cover a write', async () => {
    const app = desktop()
    const write = app.consent(request('write', '/root/a.fig'))
    app.answer((await app.question(0)).id, true)
    await write
    await app.consent(request('read', '/root/a.fig'))
    await settle()
    expect(app.asked()).toHaveLength(1)

    const read = app.consent(request('read', '/root/b.fig'))
    app.answer((await app.question(1)).id, true)
    await read
    const writeAfterRead = app.consent(request('write', '/root/b.fig'))
    const question = await app.question(2)
    expect(question).toMatchObject({ access: 'write', path: '/root/b.fig' })
    app.answer(question.id, true)
    await writeAfterRead
  })

  test('matches answers to questions by id', async () => {
    const app = desktop()
    const a = app.consent(request('write', '/root/a.fig'))
    const b = app.consent(request('write', '/root/b.fig'))
    const [first, second] = [await app.question(0), await app.question(1)]
    expect(first.id).not.toBe(second.id)

    const outcomes = Promise.allSettled([a, b])
    app.answer(second.id, false)
    app.answer(first.id, true)
    const [allowed, refused] = await outcomes
    expect(allowed.status).toBe('fulfilled')
    expect(refused.status).toBe('rejected')
  })

  test('ignores malformed lines, other messages, and answers to no question', async () => {
    const app = desktop()
    let settled = false
    const pending = app.consent(request('write', '/root/a.fig')).finally(() => {
      settled = true
    })
    const question = await app.question(0)

    app.send('not json')
    app.send(JSON.stringify({ type: 'other', id: question.id, allowed: true }))
    app.send(JSON.stringify({ type: 'consent', id: question.id, allowed: 'yes' }))
    app.send(JSON.stringify({ type: 'consent', id: question.id + 100, allowed: true }))
    await settle()
    expect(settled).toBe(false)

    app.answer(question.id, true)
    await expect(pending).resolves.toBeUndefined()
  })

  test('refuses what waits, and what comes later, once the answers stop', async () => {
    const app = desktop()
    const pending = app.consent(request('write', '/root/a.fig'))
    await app.question(0)
    app.close()
    await expect(pending).rejects.toThrow('closed')
    await expect(app.consent(request('read', '/root/b.png'))).rejects.toThrow('closed')
  })

  test('asks again for a document tool after another tool was allowed the same file', async () => {
    const app = desktop()
    const exporting = app.consent({ tool: 'export_svg', access: 'write', path: '/work/out.fig' })
    app.answer((await app.question(0)).id, true)
    await exporting
    // Allowing a document tool also gives the app the file, which the export's answer did not.
    const saving = app.consent({ tool: 'save_document', access: 'write', path: '/work/out.fig' })
    const asked = await app.question(1)
    expect(asked.tool).toBe('save_document')
    app.answer(asked.id, true)
    await expect(saving).resolves.toBeUndefined()
  })
})
