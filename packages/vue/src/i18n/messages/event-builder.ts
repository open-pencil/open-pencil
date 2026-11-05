import { i18n } from '#vue/i18n/create'

export const eventBuilderMessageDefaults = {
  welcome: 'Welcome to the event builder'
} as const

export const eventBuilderMessages = i18n('eventBuilder', eventBuilderMessageDefaults)
