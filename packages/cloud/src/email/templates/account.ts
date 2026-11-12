import type {
  AuthenticationEmailPayload,
  EmailChangeRequestedPayload,
  NewSignInPayload,
  TwoStepChange,
  TwoStepChangedPayload
} from '../schema'
import { greeting, type EmailTemplate } from './content'

/** Links in authentication emails are always set; `#` only keeps a broken one harmless. */
const actionURL = (payload: AuthenticationEmailPayload) => payload.actionURL ?? '#'

export const emailVerification: EmailTemplate<AuthenticationEmailPayload> = (payload, { t }) =>
  payload.purpose === 'change'
    ? {
        subject: t.verifyChangeSubject,
        preview: t.verifyChangePreview,
        heading: t.verifyChangeHeading,
        paragraphs: [greeting(t, payload.name), t.verifyChange],
        action: { label: t.verifyAction, url: actionURL(payload) },
        note: { text: t.verifyChangeNote }
      }
    : {
        subject: t.verifyAccountSubject,
        preview: t.verifyAccountPreview,
        heading: t.verifyAccountHeading,
        paragraphs: [greeting(t, payload.name), t.verifyAccount],
        action: { label: t.verifyAction, url: actionURL(payload) },
        note: { text: t.verifyAccountNote }
      }

export const passwordReset: EmailTemplate<AuthenticationEmailPayload> = (payload, { t }) => ({
  subject: t.passwordResetSubject,
  preview: t.passwordResetPreview,
  heading: t.passwordResetHeading,
  paragraphs: [greeting(t, payload.name), t.passwordReset],
  action: { label: t.passwordResetAction, url: actionURL(payload) },
  note: { text: t.passwordResetNote }
})

export const passwordChanged: EmailTemplate<AuthenticationEmailPayload> = (payload, { t }) => ({
  subject: t.passwordChangedSubject,
  preview: t.passwordChangedPreview,
  heading: t.passwordChangedHeading,
  paragraphs: [greeting(t, payload.name), t.passwordChanged],
  action: { label: t.openCloud, url: actionURL(payload) }
})

export const emailChangeRequested: EmailTemplate<EmailChangeRequestedPayload> = (
  payload,
  { t }
) => ({
  subject: t.emailChangeSubject,
  preview: t.emailChangePreview({ email: payload.newEmail }),
  heading: t.emailChangeHeading,
  paragraphs: [
    greeting(t, payload.name),
    t.emailChange({ email: payload.newEmail }),
    t.emailChangeNotYou
  ],
  action: { label: t.reviewAccount, url: payload.actionURL }
})

export const newSignIn: EmailTemplate<NewSignInPayload> = (payload, { t, dateTime }) => {
  const { browser, system } = payload
  let device = browser ?? system ?? t.newSignInUnknownBrowser
  if (payload.desktop) device = t.newSignInApp
  else if (browser && system) device = t.newSignInBrowser({ browser, system })
  const date = dateTime(payload.signedInAt)
  return {
    subject: t.newSignInSubject,
    preview: t.newSignInPreview({ device }),
    heading: t.newSignInHeading,
    paragraphs: [
      greeting(t, payload.name),
      payload.ipAddress
        ? t.newSignInFrom({ device, address: payload.ipAddress, date })
        : t.newSignIn({ device, date }),
      t.newSignInNotYou
    ],
    action: { label: t.reviewSessions, url: payload.actionURL }
  }
}

export const twoStepChanged: EmailTemplate<TwoStepChangedPayload> = (payload, { t }) => {
  const copy: Record<TwoStepChange, { heading: string; message: string }> = {
    'authenticator-on': { heading: t.authenticatorOnHeading, message: t.authenticatorOn },
    'authenticator-off': { heading: t.authenticatorOffHeading, message: t.authenticatorOff },
    'passkey-added': { heading: t.passkeyAddedHeading, message: t.passkeyAdded },
    'passkey-removed': { heading: t.passkeyRemovedHeading, message: t.passkeyRemoved },
    'reset-by-administrator': { heading: t.twoStepResetHeading, message: t.twoStepReset }
  }
  const { heading, message } = copy[payload.change]
  return {
    subject: t.twoStepSubject,
    preview: message,
    heading,
    paragraphs: [greeting(t, payload.name), message, t.twoStepNotYou],
    action: { label: t.reviewSecurity, url: payload.actionURL }
  }
}
