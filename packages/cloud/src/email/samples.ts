import type { TransactionalEmailContent } from './schema'

/** Where every sample's button goes. */
export const EMAIL_SAMPLE_URL = 'https://cloud.example.com/next'

/**
 * One email of every kind, with every optional part filled, as previews and tests show them. Its
 * names and addresses are made up.
 */
export const EMAIL_SAMPLES: TransactionalEmailContent[] = [
  {
    kind: 'document-invitation',
    payload: {
      inviterName: 'Ada',
      documentName: 'Homepage',
      permission: 'edit',
      expiresAt: '2026-11-20T10:00:00.000Z',
      acceptanceURL: EMAIL_SAMPLE_URL
    }
  },
  {
    kind: 'workspace-invitation',
    payload: {
      inviterName: null,
      workspaceName: 'Studio',
      role: 'viewer',
      expiresAt: '2026-11-20T10:00:00.000Z',
      acceptanceURL: EMAIL_SAMPLE_URL
    }
  },
  ...(
    [
      'enrollment-requested',
      'enrollment-approved',
      'enrollment-rejected',
      'enrollment-revoked'
    ] as const
  ).map((kind): TransactionalEmailContent => ({
    kind,
    payload: { name: 'Ada', actionURL: EMAIL_SAMPLE_URL }
  })),
  {
    kind: 'admin-enrollment-notification',
    payload: {
      requesterEmail: 'ada@example.com',
      requesterName: 'Ada',
      reason: 'Design',
      actionURL: EMAIL_SAMPLE_URL
    }
  },
  {
    kind: 'email-verification',
    payload: { name: 'Ada', actionURL: EMAIL_SAMPLE_URL, purpose: 'change' }
  },
  { kind: 'password-reset', payload: { name: 'Ada', actionURL: EMAIL_SAMPLE_URL } },
  { kind: 'password-changed', payload: { name: 'Ada', actionURL: EMAIL_SAMPLE_URL } },
  {
    kind: 'email-change-requested',
    payload: { name: 'Ada', newEmail: 'ada@new.example.com', actionURL: EMAIL_SAMPLE_URL }
  },
  {
    kind: 'new-sign-in',
    payload: {
      name: 'Ada',
      signedInAt: '2026-11-13T10:00:00.000Z',
      ipAddress: '203.0.113.9',
      browser: 'Firefox',
      system: 'Linux',
      desktop: false,
      actionURL: EMAIL_SAMPLE_URL
    }
  },
  {
    kind: 'two-step-changed',
    payload: { name: 'Ada', change: 'passkey-added', actionURL: EMAIL_SAMPLE_URL }
  },
  {
    kind: 'document-report',
    payload: {
      documentName: 'Homepage',
      reason: 'copyright',
      description: 'Copied',
      actionURL: EMAIL_SAMPLE_URL
    }
  },
  {
    kind: 'storage-limit-reached',
    payload: {
      name: 'Ada',
      usedBytes: 310 * 1024 ** 2,
      limitBytes: 300 * 1024 ** 2,
      upgradable: true,
      actionURL: EMAIL_SAMPLE_URL
    }
  },
  {
    kind: 'document-blocked',
    payload: {
      name: 'Ada',
      documentName: 'Homepage',
      reason: 'Phishing page imitating a bank',
      contactEmail: 'abuse@example.com',
      actionURL: EMAIL_SAMPLE_URL
    }
  },
  {
    kind: 'document-restored',
    payload: { name: 'Ada', documentName: 'Homepage', actionURL: EMAIL_SAMPLE_URL }
  },
  { kind: 'document-report-received', payload: { documentName: 'Homepage' } },
  {
    kind: 'document-report-decided',
    payload: { documentName: 'Homepage', outcome: 'blocked', contactEmail: 'abuse@example.com' }
  }
]
