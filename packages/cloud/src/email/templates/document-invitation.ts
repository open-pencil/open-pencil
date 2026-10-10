import { defineComponent, type PropType } from 'vue'

import { transactionalEmailLayout } from './layout'

export type DocumentInvitationEmailProps = {
  inviterName: string
  documentName: string
  permissionLabel: string
  expiresAt: string
  acceptanceURL: string
}

export const DocumentInvitationEmail = defineComponent({
  props: {
    inviterName: { type: String, required: true },
    documentName: { type: String, required: true },
    permissionLabel: { type: String, required: true },
    expiresAt: { type: String, required: true },
    acceptanceURL: { type: String, required: true }
  } satisfies Record<
    keyof DocumentInvitationEmailProps,
    { type: PropType<string>; required: true }
  >,
  setup(props) {
    return () =>
      transactionalEmailLayout({
        preview: `${props.inviterName} invited you to ${props.permissionLabel} a document`,
        heading: 'OpenPencil invitation',
        message: `${props.inviterName} invited you to ${props.permissionLabel} “${props.documentName}”.`,
        actionLabel: 'Open document',
        actionURL: props.acceptanceURL,
        footer: `This invitation expires ${props.expiresAt}.`
      })
  }
})
