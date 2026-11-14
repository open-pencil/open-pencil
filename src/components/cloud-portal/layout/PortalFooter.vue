<script setup lang="ts">
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { portalPublic } from '@/components/cloud-portal/ui'
import { CLOUD_DOCS_URL } from '@/constants'

import { usePortalLegal } from './legal'
import PortalLanguageSelect from './PortalLanguageSelect.vue'

/** The foot of a public Cloud page: the server's address, help, and the operator's legal links. */
const { host } = defineProps<{ host: string }>()

const ui = portalPublic()
const messages = useCloudPortalMessages()
const legal = usePortalLegal()
</script>

<template>
  <footer :class="ui.footer()">
    <span>{{ host }}</span>
    <a :href="CLOUD_DOCS_URL" target="_blank" rel="noreferrer" :class="ui.footerLink()">
      {{ messages.help }}
    </a>
    <a
      v-if="legal?.termsURL"
      :href="legal.termsURL"
      target="_blank"
      rel="noreferrer"
      :class="ui.footerLink()"
    >
      {{ messages.termsOfService }}
    </a>
    <a
      v-if="legal?.privacyURL"
      :href="legal.privacyURL"
      target="_blank"
      rel="noreferrer"
      :class="ui.footerLink()"
    >
      {{ messages.privacyPolicy }}
    </a>
    <a v-if="legal?.abuseEmail" :href="`mailto:${legal.abuseEmail}`" :class="ui.footerLink()">
      {{ messages.reportAbuse }}
    </a>
    <PortalLanguageSelect />
  </footer>
</template>
