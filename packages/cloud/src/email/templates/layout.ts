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
import { h, type VNode } from 'vue'

export type TransactionalEmailLayout = {
  preview: string
  heading: string
  message: string
  actionLabel: string
  actionURL: string
  footer?: string
}

export function transactionalEmailLayout(props: TransactionalEmailLayout): VNode {
  return h(HTML, { lang: 'en' }, () => [
    h(Head),
    h(Preview, () => props.preview),
    h(Body, { style: { backgroundColor: '#f5f5f5', fontFamily: 'Arial, sans-serif' } }, () =>
      h(
        Container,
        { style: { margin: '40px auto', padding: '32px', backgroundColor: '#ffffff' } },
        () => [
          h(Heading, { as: 'h1', style: { fontSize: '22px' } }, () => props.heading),
          h(Text, () => props.message),
          h(
            Button,
            {
              href: props.actionURL,
              style: { backgroundColor: '#171717', color: '#ffffff', padding: '12px 18px' }
            },
            () => props.actionLabel
          ),
          props.footer
            ? h(Text, { style: { color: '#737373', fontSize: '12px' } }, () => props.footer)
            : null
        ]
      )
    )
  ])
}
