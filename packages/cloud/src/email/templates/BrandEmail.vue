<script setup lang="ts">
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  // eslint-disable-next-line @open-pencil/structure/no-mixed-case-acronym-identifiers -- Upstream export spelling.
  Html as HTML,
  Img,
  Link,
  Preview,
  Section,
  Text
} from '@vue-email/components'

import { LOGO_URL, SITE_URL, styles } from './brand'
import { useEmailLocalization } from './localization'

/**
 * The branded email every OpenPencil service sends, in its reader's language and direction: a
 * heading, the paragraphs in the default slot, one button, and small print in `note`.
 */
const { preview, heading, action } = defineProps<{
  /** The line mail clients show beside the subject. */
  preview: string
  heading: string
  /** The one thing the email asks the reader to do, if there is one. */
  action?: { label: string; url: string }
}>()

const { locale, dir, t } = useEmailLocalization()
</script>

<template>
  <HTML :lang="locale" :dir="dir">
    <Head />
    <Preview>{{ preview }}</Preview>
    <Body :style="styles.body">
      <Container :style="styles.card">
        <Img :src="LOGO_URL" :width="44" :height="44" alt="OpenPencil" :style="styles.logo" />
        <Heading as="h1" :style="styles.heading">{{ heading }}</Heading>
        <slot />
        <Section v-if="action" :style="styles.action">
          <Button :href="action.url" :style="styles.button">{{ action.label }}</Button>
        </Section>
        <Text v-if="$slots.note" :style="styles.note"><slot name="note" /></Text>
      </Container>
      <Text :style="styles.footer">
        {{ t.footer }} · <Link :href="SITE_URL" :style="styles.footerLink">openpencil.dev</Link>
      </Text>
    </Body>
  </HTML>
</template>
