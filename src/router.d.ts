import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** Cloud portal: only for people who are not signed in; signed-in people continue instead. */
    signedOut?: boolean
    /** Cloud portal: needs a signed-in account in good standing. */
    account?: boolean
    /** Cloud portal: needs a deployment administrator. */
    admin?: boolean
    demo?: boolean
  }
}
