import { describe, expect, test } from 'bun:test'
import { ByteBuffer } from '../../packages/core/src/kiwi/kiwi-schema/bb'

describe('kiwi ByteBuffer UTF-8 string handling', () => {
  test('round-trips CJK text without mojibake', () => {
    const input = '中文测试：你好，世界'
    const bb = new ByteBuffer()
    bb.writeString(input)

    const decoded = new ByteBuffer(bb.toUint8Array()).readString()
    expect(decoded).toBe(input)
  })

  test('round-trips mixed unicode including emoji', () => {
    const input = 'OpenPencil 字体 ✅ 😀 𠮷野家'
    const bb = new ByteBuffer()
    bb.writeString(input)

    const decoded = new ByteBuffer(bb.toUint8Array()).readString()
    expect(decoded).toBe(input)
  })
})
