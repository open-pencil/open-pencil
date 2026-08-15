import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html as HTML,
  Preview,
  Text
} from '@vue-email/components'
import { defineComponent, h, type PropType } from 'vue'

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
      h(HTML, { lang: 'en' }, () => [
        h(Head),
        h(Preview, () => `${props.inviterName} invited you to ${props.permissionLabel} a document`),
        h(Body, { style: { backgroundColor: '#f5f5f5', fontFamily: 'Arial, sans-serif' } }, () =>
          h(
            Container,
            { style: { margin: '40px auto', padding: '32px', backgroundColor: '#ffffff' } },
            () => [
              h(Heading, { as: 'h1', style: { fontSize: '22px' } }, () => 'OpenPencil invitation'),
              h(
                Text,
                () =>
                  `${props.inviterName} invited you to ${props.permissionLabel} “${props.documentName}”.`
              ),
              h(
                Button,
                {
                  href: props.acceptanceURL,
                  style: { backgroundColor: '#171717', color: '#ffffff', padding: '12px 18px' }
                },
                () => 'Open document'
              ),
              h(
                Text,
                { style: { color: '#737373', fontSize: '12px' } },
                () => `This invitation expires ${props.expiresAt}.`
              )
            ]
          )
        )
      ])
  }
})
