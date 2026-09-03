import { describe, expect, test } from 'bun:test'

import { renderTransactionalEmail } from '@open-pencil/cloud/email'

const enrollmentKinds = [
  'enrollment-requested',
  'enrollment-approved',
  'enrollment-rejected',
  'enrollment-revoked'
] as const

describe('enrollment email rendering', () => {
  for (const kind of enrollmentKinds) {
    test(`renders HTML and text for ${kind}`, async () => {
      const rendered = await renderTransactionalEmail(kind, {
        name: 'Person',
        actionURL: 'https://cloud.example.com/auth/sign-in'
      })
      expect(rendered.subject).toBeString()
      expect(rendered.html).toContain('https://cloud.example.com/auth/sign-in')
      expect(rendered.text).toContain('https://cloud.example.com/auth/sign-in')
      expect(rendered.html).not.toContain('internal note')
    })
  }
  test('renders administrator notification without an approval token', async () => {
    const rendered = await renderTransactionalEmail('admin-enrollment-notification', {
      requesterEmail: 'person@example.com',
      requesterName: 'Person',
      reason: 'Design',
      actionURL: 'https://cloud.example.com/admin/enrollment'
    })
    expect(rendered.html).toContain('person@example.com')
    expect(rendered.html).toContain('/admin/enrollment')
    expect(rendered.html).not.toContain('token=')
  })
})
