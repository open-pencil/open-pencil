import { expect, test } from 'bun:test'

import { commonMessages, filesMessages } from '@open-pencil/vue'

import { chooseNativeDocumentClose } from '@/app/document/close/native'

type DialogCall = { message: string; options?: { title?: string; buttons?: unknown } }

function dialogReturning(result: string) {
  const calls: DialogCall[] = []
  return {
    calls,
    show: async (message: string, options?: DialogCall['options']) => {
      calls.push({ message, options })
      return result
    }
  }
}

test('maps the native Save, Don’t Save, and Cancel results to close choices', async () => {
  const files = filesMessages.get()
  const common = commonMessages.get()
  expect(await chooseNativeDocumentClose('Untitled', dialogReturning(common.save).show)).toBe(
    'save'
  )
  expect(await chooseNativeDocumentClose('Untitled', dialogReturning(files.discard).show)).toBe(
    'discard'
  )
  expect(await chooseNativeDocumentClose('Untitled', dialogReturning(common.cancel).show)).toBe(
    'cancel'
  )
  expect(await chooseNativeDocumentClose('Untitled', dialogReturning('Unexpected').show)).toBe(
    'cancel'
  )
})

test('offers the localized buttons and names the document in the title', async () => {
  const files = filesMessages.get()
  const common = commonMessages.get()
  const dialog = dialogReturning(common.cancel)
  await chooseNativeDocumentClose('Brand kit', dialog.show)
  expect(dialog.calls[0]?.options?.title).toBe(files.saveBeforeClosing({ name: 'Brand kit' }))
  expect(dialog.calls[0]?.options?.buttons).toEqual({
    yes: common.save,
    no: files.discard,
    cancel: common.cancel
  })
})
