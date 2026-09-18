import { describe, expect, mock, test } from 'bun:test'

import {
  openWebLink,
  openWebLinkFromLocation,
  parseWebOpenParams,
  withoutWebLinkParams
} from '@/app/document/io/web-link'

const RAW = 'https://raw.githubusercontent.com/o/r/master/design/hikyo.pen'

describe('parseWebOpenParams', () => {
  test('accepts an https .pen URL with a node', () => {
    const target = parseWebOpenParams(
      `?file=${encodeURIComponent(RAW)}&node=Button%2FLarge%2FDefault`
    )
    expect(target?.file.href).toBe(RAW)
    expect(target?.node).toBe('Button/Large/Default')
  })

  test('accepts a .fig URL without a node', () => {
    const target = parseWebOpenParams('?file=https%3A%2F%2Fexample.com%2Fa%2Fb.FIG')
    expect(target?.file.href).toBe('https://example.com/a/b.FIG')
    expect(target?.node).toBeUndefined()
  })

  test('drops the fragment, so two links to one file do not open two tabs', () => {
    // The tab identity compares the source URL exactly; a fragment never reaches the
    // server, so keeping it would duplicate the document once per fragment.
    const first = parseWebOpenParams(`?file=${encodeURIComponent(`${RAW}#Button`)}`)
    const second = parseWebOpenParams(`?file=${encodeURIComponent(`${RAW}#Card`)}`)
    expect(first?.file.href).toBe(RAW)
    expect(first?.file.href).toBe(second?.file.href)
  })

  test('keeps the query string, which the server does see', () => {
    const target = parseWebOpenParams(`?file=${encodeURIComponent(`${RAW}?v=2#x`)}`)
    expect(target?.file.href).toBe(`${RAW}?v=2`)
  })

  test('refuses http', () => {
    expect(parseWebOpenParams('?file=http%3A%2F%2Fexample.com%2Fa.pen')).toBeNull()
  })

  test('refuses file URLs', () => {
    expect(parseWebOpenParams('?file=file%3A%2F%2F%2Fetc%2Fpasswd.pen')).toBeNull()
  })

  test('refuses another extension', () => {
    expect(parseWebOpenParams('?file=https%3A%2F%2Fexample.com%2Fa.svg')).toBeNull()
  })

  test('refuses a relative path, which has no protocol of its own', () => {
    expect(parseWebOpenParams('?file=design%2Fhikyo.pen')).toBeNull()
  })

  test('returns null without a file', () => {
    expect(parseWebOpenParams('?node=Button')).toBeNull()
    expect(parseWebOpenParams('')).toBeNull()
    expect(parseWebOpenParams('?file=&node=Button')).toBeNull()
  })

  test('reads the extension off the path, not the query', () => {
    expect(parseWebOpenParams('?file=https%3A%2F%2Fh%2Fa.svg%3Fx%3D.pen')).toBeNull()
    expect(parseWebOpenParams('?file=https%3A%2F%2Fh%2Fa.pen%3Fv%3D1')?.file.href).toBe(
      'https://h/a.pen?v=1'
    )
  })

  test('accepts an uppercase extension, which the reader registry lowercases anyway', () => {
    expect(parseWebOpenParams('?file=https%3A%2F%2Fh%2Fa.PEN')?.file.href).toBe('https://h/a.PEN')
  })

  test('takes the last value of a repeated key, like the desktop parser', () => {
    const target = parseWebOpenParams(
      '?file=https%3A%2F%2Fh%2Fa.pen&file=https%3A%2F%2Fh%2Fb.pen&node=A&node=B'
    )
    expect(target?.file.href).toBe('https://h/b.pen')
    expect(target?.node).toBe('B')
  })

  test('ignores an empty node', () => {
    expect(parseWebOpenParams(`?file=${encodeURIComponent(RAW)}&node=`)?.node).toBeUndefined()
  })
})

describe('openWebLink', () => {
  const target = { file: new URL(RAW), node: 'Button/Large/Default' }

  test('selects the node after the document opens', async () => {
    const open = mock(async (): Promise<void> => undefined)
    const selectByName = mock(() => true)
    const notices: string[] = []

    await openWebLink(target, { selectByName, notify: (m) => notices.push(m) }, { open })

    expect(open).toHaveBeenCalledWith(target.file)
    expect(selectByName).toHaveBeenCalledWith('Button/Large/Default')
    expect(notices).toEqual([])
  })

  test('notifies with the host, not the whole link, when the fetch fails', async () => {
    const open = mock(async (): Promise<void> => {
      throw new Error('Failed to fetch')
    })
    const selectByName = mock(() => true)
    const notices: string[] = []

    await openWebLink(target, { selectByName, notify: (m) => notices.push(m) }, { open })

    expect(selectByName).not.toHaveBeenCalled()
    expect(notices).toHaveLength(1)
    expect(notices[0]).toContain('raw.githubusercontent.com')
  })

  test('notifies when the node is missing', async () => {
    const open = mock(async (): Promise<void> => undefined)
    const notices: string[] = []

    await openWebLink(
      target,
      { selectByName: () => false, notify: (m) => notices.push(m) },
      { open }
    )

    expect(notices).toHaveLength(1)
    expect(notices[0]).toContain('Button/Large/Default')
  })
})

describe('openWebLinkFromLocation', () => {
  const link = `?tab=2&file=${encodeURIComponent(RAW)}&node=Button%2FLarge%2FDefault#frag`

  test('strips the params before the document is fetched', async () => {
    const order: string[] = []
    const open = mock(async (): Promise<void> => {
      order.push('open')
    })

    await openWebLinkFromLocation(
      link,
      () => order.push('strip'),
      { selectByName: () => true, notify: () => undefined },
      { open }
    )

    expect(order).toEqual(['strip', 'open'])
  })

  test('strips a refused link too, and opens nothing', async () => {
    const open = mock(async (): Promise<void> => undefined)
    const strip = mock(() => undefined)

    await openWebLinkFromLocation(
      '?file=http%3A%2F%2Fexample.com%2Fa.pen&node=X',
      strip,
      { selectByName: () => true, notify: () => undefined },
      { open }
    )

    expect(strip).toHaveBeenCalledTimes(1)
    expect(open).not.toHaveBeenCalled()
  })

  test('does nothing at all when neither param is present', async () => {
    const open = mock(async (): Promise<void> => undefined)
    const strip = mock(() => undefined)

    await openWebLinkFromLocation(
      '?tab=2',
      strip,
      { selectByName: () => true, notify: () => undefined },
      { open }
    )

    expect(strip).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })
})

describe('withoutWebLinkParams', () => {
  test('removes both link params and keeps everything else', () => {
    expect(
      withoutWebLinkParams({ file: 'https://h/a.pen', node: 'A', tab: '2', test: '' })
    ).toEqual({
      tab: '2',
      test: ''
    })
  })

  test('leaves a query with no link params untouched', () => {
    expect(withoutWebLinkParams({ renderer: 'tiled' })).toEqual({ renderer: 'tiled' })
  })
})
