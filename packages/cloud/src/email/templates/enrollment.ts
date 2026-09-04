import { defineComponent, type PropType } from 'vue'

import { transactionalEmailLayout } from './layout'

export type EnrollmentEmailProps = {
  heading: string
  preview: string
  message: string
  actionLabel: string
  actionURL: string
}

export const EnrollmentEmail = defineComponent({
  props: {
    heading: { type: String, required: true },
    preview: { type: String, required: true },
    message: { type: String, required: true },
    actionLabel: { type: String, required: true },
    actionURL: { type: String, required: true }
  } satisfies Record<keyof EnrollmentEmailProps, { type: PropType<string>; required: true }>,
  setup(props) {
    return () => transactionalEmailLayout(props)
  }
})
