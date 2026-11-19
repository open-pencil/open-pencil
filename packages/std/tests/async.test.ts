import { describe, expect, test } from 'bun:test'

import { createDeferred, createKeyedMutex, createMutex } from '@open-pencil/std/async'

describe('createDeferred', () => {
  test('settles from outside the promise', async () => {
    const resolved = createDeferred<number>()
    resolved.resolve(3)
    expect(await resolved.promise).toBe(3)
    const rejected = createDeferred<number>()
    rejected.reject(new Error('no'))
    expect(rejected.promise).rejects.toThrow('no')
  })
})

describe('createMutex', () => {
  test('runs holders one at a time, in arrival order', async () => {
    const mutex = createMutex()
    const order: string[] = []
    const first = createDeferred<undefined>()
    const a = mutex.run(async () => {
      order.push('a start')
      await first.promise
      order.push('a end')
    })
    const b = mutex.run(() => {
      order.push('b')
    })
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
    expect(order).toEqual(['a start'])
    first.resolve(undefined)
    await Promise.all([a, b])
    expect(order).toEqual(['a start', 'a end', 'b'])
  })

  test('takes the next turn after a holder fails', async () => {
    const mutex = createMutex()
    const failed = mutex.run(() => Promise.reject(new Error('broke')))
    const next = mutex.run(() => 'ran')
    expect(failed).rejects.toThrow('broke')
    expect(await next).toBe('ran')
  })

  test('a holder whose signal aborts while waiting never runs, and the next goes on', async () => {
    const mutex = createMutex()
    const release = await mutex.acquire()
    const controller = new AbortController()
    let ran = false
    const waiting = mutex.run(() => {
      ran = true
    }, controller.signal)
    const after = mutex.run(() => 'after')
    controller.abort()
    expect(waiting).rejects.toThrow()
    release()
    expect(await after).toBe('after')
    expect(ran).toBe(false)
  })

  test('an already aborted signal rejects at once', async () => {
    const mutex = createMutex()
    expect(mutex.acquire(AbortSignal.abort())).rejects.toThrow()
  })
})

describe('createKeyedMutex', () => {
  test('holders of one key take turns while other keys run alongside', async () => {
    const mutex = createKeyedMutex<string>()
    const order: string[] = []
    const first = createDeferred<undefined>()
    const a = mutex.run('file', async () => {
      order.push('a')
      await first.promise
      order.push('a done')
    })
    const b = mutex.run('file', () => {
      order.push('b')
    })
    const other = mutex.run('other', () => {
      order.push('other')
    })
    await other
    expect(order).toEqual(['a', 'other'])
    first.resolve(undefined)
    await Promise.all([a, b])
    expect(order).toEqual(['a', 'other', 'a done', 'b'])
  })

  test('a key used again after it went idle starts a fresh turn order', async () => {
    const mutex = createKeyedMutex<string>()
    expect(mutex.run('file', () => Promise.reject(new Error('broke')))).rejects.toThrow('broke')
    expect(await mutex.run('file', () => 'again')).toBe('again')
  })
})
