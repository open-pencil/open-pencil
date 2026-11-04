import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import PortalPictureDialog from './PortalPictureDialog.vue'

type Args = { file: File | null; error: string | null; onSave: (picture: Blob) => void }

/** A wide picture, so the crop has room to move sideways. */
const picture = new File(
  [
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#0ea5e9"/><circle cx="320" cy="170" r="90" fill="#f8fafc"/><rect x="170" y="280" width="300" height="140" rx="70" fill="#f8fafc"/></svg>'
  ],
  'picture.svg',
  { type: 'image/svg+xml' }
)

const meta = {
  title: 'App/Cloud Portal/Picture',
  args: { file: picture, error: null, onSave: fn() },
  render: (args) => ({
    components: { PortalPictureDialog },
    setup: () => ({ args }),
    template: `
      <PortalPictureDialog
        :open="true"
        :file="args.file"
        :error="args.error"
        @save="args.onSave"
      />`
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const Crop: Story = {
  play: async ({ args }) => {
    const page = within(document.body)
    const save = await page.findByRole('button', { name: 'Save picture' })
    await waitFor(() => expect(save).toBeEnabled())
    await userEvent.click(save)
    await waitFor(() => expect(args.onSave).toHaveBeenCalledWith(expect.any(Blob)))
  }
}

export const Unreadable: Story = {
  args: { file: new File(['not a picture'], 'notes.png', { type: 'image/png' }) },
  play: async () => {
    const page = within(document.body)
    await expect(await page.findByText(/isn’t a picture the page can open/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save picture' })).toBeDisabled()
  }
}

export const Refused: Story = {
  args: { error: 'The server can’t use this picture. Choose another image.' }
}
