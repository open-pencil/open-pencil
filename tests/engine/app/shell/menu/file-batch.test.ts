import { afterEach, describe, expect, mock, test } from 'bun:test'

import { localeSetting } from '@open-pencil/vue'

import { openDesignFileBatch } from '@/app/shell/menu/files'
import { toast } from '@/app/shell/ui'

afterEach(() => {
  toast.toasts.value = []
  localeSetting.set(undefined)
})

describe('openDesignFileBatch', () => {
  test('opens selected files sequentially in selection order', async () => {
    const opened: string[] = []
    const openItem = mock(async (name: string) => {
      opened.push(name)
    })

    await openDesignFileBatch(['first.fig', 'second.pen'], (name) => name, openItem)

    expect(opened).toEqual(['first.fig', 'second.pen'])
    expect(openItem).toHaveBeenCalledTimes(2)
  })

  test('reports one failed file and continues opening later selections', async () => {
    localeSetting.set('en')
    const opened: string[] = []
    const openItem = mock(async (name: string) => {
      opened.push(name)
      if (name === 'broken.fig') throw new Error('Invalid FIG container')
    })

    await expect(
      openDesignFileBatch(['first.fig', 'broken.fig', 'last.pen'], (name) => name, openItem)
    ).resolves.toBeUndefined()

    expect(opened).toEqual(['first.fig', 'broken.fig', 'last.pen'])
    expect(toast.toasts.value).toHaveLength(1)
    expect(toast.toasts.value[0]).toMatchObject({
      message: 'Could not open “broken.fig”: Invalid FIG container',
      variant: 'error'
    })
  })
})
