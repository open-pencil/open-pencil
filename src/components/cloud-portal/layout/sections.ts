import type { Component } from 'vue'
import IconFileText from '~icons/lucide/file-text'
import IconFlag from '~icons/lucide/flag'
import IconGauge from '~icons/lucide/gauge'
import IconHistory from '~icons/lucide/history'
import IconMail from '~icons/lucide/mail'
import IconMonitorSmartphone from '~icons/lucide/monitor-smartphone'
import IconShieldCheck from '~icons/lucide/shield-check'
import IconUserPlus from '~icons/lucide/user-plus'
import IconUserRound from '~icons/lucide/user-round'
import IconUsers from '~icons/lucide/users'

/** The icon beside each console section in the side list. */
export const PORTAL_SECTION_ICONS = {
  profile: IconUserRound,
  security: IconShieldCheck,
  sessions: IconMonitorSmartphone,
  overview: IconGauge,
  requests: IconUserPlus,
  reports: IconFlag,
  documents: IconFileText,
  people: IconUsers,
  email: IconMail,
  activity: IconHistory
} satisfies Record<string, Component>
