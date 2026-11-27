/** The Developers overview's URL scheme section, now a page of its own in every locale. */
const URL_SCHEME = Object.fromEntries(
  ['', '/de', '/es', '/fr', '/it', '/pl', '/ru'].map((locale) => [
    `${locale}/developers/`,
    { 'url-scheme': `${locale}/developers/url-scheme` }
  ])
)

/**
 * Sections that moved to pages of their own when OpenPencil Cloud got its own section. The server
 * redirects the old pages (`public/_redirects`) and the browser keeps the `#section`, which the
 * new page doesn't have, so the first load sends it on to where that section lives now.
 */
const MOVED_SECTIONS: Record<string, Record<string, string>> = {
  ...URL_SCHEME,
  // Opening and saving became a page of their own.
  '/user-guide/exporting/': {
    'fig-file-operations': '/user-guide/files',
    'opening-files': '/user-guide/files#open-a-document',
    'saving-files': '/user-guide/files#save',
    'round-trip-compatibility': '/user-guide/files#save'
  },
  // Libraries became a page of their own, and behaviours a task on the Components page.
  '/user-guide/components/': {
    'component-libraries': '/user-guide/component-libraries',
    'publish-a-library': '/user-guide/component-libraries#publish-a-library',
    'enable-and-insert-library-assets': '/user-guide/component-libraries#use-a-library',
    'review-and-accept-updates': '/user-guide/component-libraries#update-to-a-new-version',
    'local-storage-and-offline-use': '/user-guide/component-libraries#where-libraries-live',
    'saving-consumer-documents': '/user-guide/component-libraries#where-libraries-live',
    'behaviours-and-preview': '/user-guide/components#make-a-component-work-like-a-control'
  },
  // The Context Menu page's actions moved to the pages of the tasks they belong to.
  '/user-guide/selection-and-manipulation/': {
    'copy-paste-as': '/user-guide/exporting#copy-into-another-app',
    'clipboard-actions': '/user-guide/selection-and-manipulation#copy-paste-and-delete',
    'copy-and-paste-properties': '/user-guide/selection-and-manipulation#copy-the-look-of-a-layer',
    'z-order': '/user-guide/selection-and-manipulation#put-layers-in-front-or-behind',
    grouping: '/user-guide/selection-and-manipulation#group-layers',
    'component-actions': '/user-guide/components',
    'visibility-lock': '/user-guide/selection-and-manipulation#hide-and-lock-layers',
    'move-to-page': '/user-guide/layers-and-pages#work-with-pages'
  },
  // Sections renamed or merged when these pages were rewritten as tasks.
  '/user-guide/ai-chat/': {
    'supported-providers': '/user-guide/models-and-providers#providers',
    setup: '/user-guide/ai-chat#set-up-the-ai',
    'step-limit': '/user-guide/ai-chat#while-the-ai-works',
    'tool-access': '/user-guide/ai-chat#choose-what-the-ai-can-do',
    skills: '/user-guide/ai-chat#teach-the-ai-with-skills',
    'saved-conversations': '/user-guide/ai-chat#long-conversations',
    'what-it-can-do': '/user-guide/ai-chat#ask-for-a-design',
    'visual-verification': '/user-guide/ai-chat#ask-for-a-design',
    'design-reviews': '/user-guide/ai-chat#ask-for-a-review',
    prompts: '/user-guide/ai-chat#change-the-ai-s-instructions',
    'context-and-compaction': '/user-guide/ai-chat#long-conversations',
    'messages-while-the-assistant-works': '/user-guide/ai-chat#while-the-ai-works',
    'stopping-a-reply': '/user-guide/ai-chat#while-the-ai-works',
    'undoing-the-assistant-s-edits': '/user-guide/ai-chat#undo-what-the-ai-did',
    'following-the-assistant': '/user-guide/ai-chat#while-the-ai-works',
    notifications: '/user-guide/ai-chat#get-notified',
    'example-prompts': '/user-guide/ai-chat#ask-for-a-design',
    tips: '/user-guide/ai-chat#ask-for-a-design'
  },
  '/user-guide/coding-agents/': {
    'what-you-need': '/user-guide/coding-agents#set-up-an-agent',
    'let-your-agent-set-itself-up': '/user-guide/coding-agents#set-up-an-agent',
    'models-and-roles': '/user-guide/coding-agents#choose-the-model-and-mode'
  },
  '/user-guide/drawing-shapes/': {
    'toolbar-tools': '/user-guide/drawing-shapes#draw-a-shape',
    'shapes-flyout': '/user-guide/drawing-shapes#draw-a-shape',
    'customizing-the-toolbar': '/user-guide/drawing-shapes#arrange-the-toolbar',
    'constrained-drawing': '/user-guide/drawing-shapes#draw-a-shape',
    'shape-properties': '/user-guide/drawing-shapes#color-a-shape',
    fill: '/user-guide/drawing-shapes#color-a-shape',
    stroke: '/user-guide/drawing-shapes#add-an-outline',
    'corner-radius': '/user-guide/drawing-shapes#round-the-corners',
    effects: '/user-guide/drawing-shapes#add-shadows-and-blurs',
    'frames-and-sections': '/user-guide/drawing-shapes#draw-a-frame',
    'keyboard-shortcuts': '/user-guide/drawing-shapes#draw-a-shape',
    tips: '/user-guide/drawing-shapes#draw-a-shape'
  },
  '/user-guide/pen-tool/': {
    activating: '/user-guide/pen-tool#draw-a-path',
    'placing-points': '/user-guide/pen-tool#draw-a-path',
    'closing-a-path': '/user-guide/pen-tool#draw-a-path',
    'open-paths': '/user-guide/pen-tool#draw-a-path',
    'vector-networks': '/user-guide/vector-edit',
    pencil: '/user-guide/pen-tool#draw-freehand',
    'keyboard-shortcuts': '/user-guide/pen-tool#draw-a-path',
    tips: '/user-guide/pen-tool#draw-a-path'
  },
  '/user-guide/vector-edit/': {
    'entering-the-mode': '/user-guide/vector-edit#edit-a-path',
    'exiting-the-mode': '/user-guide/vector-edit#edit-a-path',
    'what-changes-in-this-mode': '/user-guide/vector-edit#edit-a-path',
    'basic-actions': '/user-guide/vector-edit#edit-a-path',
    'move-an-anchor': '/user-guide/vector-edit#edit-a-path',
    'edit-a-bezier-handle': '/user-guide/vector-edit#edit-a-path',
    'select-and-move-a-segment': '/user-guide/vector-edit#edit-a-path',
    'select-with-a-marquee': '/user-guide/vector-edit#edit-a-path',
    'select-a-region': '/user-guide/vector-edit#edit-a-path',
    'delete-anchors-and-segments': '/user-guide/vector-edit#add-and-delete-points',
    'handle-drag-modifiers': '/user-guide/vector-edit#shape-a-curve',
    'bend-override-by-dragging-an-anchor': '/user-guide/vector-edit#shape-a-curve',
    'using-the-pen-tool-in-edit-mode': '/user-guide/vector-edit#add-and-delete-points',
    'practical-workflow': '/user-guide/vector-edit#edit-a-path'
  },
  '/user-guide/text-editing/': {
    'creating-text': '/user-guide/text-editing#add-text',
    'inline-editing': '/user-guide/text-editing#change-text',
    'cursor-navigation': '/user-guide/text-editing#change-text',
    'text-selection': '/user-guide/text-editing#change-text',
    'rich-text-formatting': '/user-guide/text-editing#style-text',
    'editing-operations': '/user-guide/text-editing#change-text',
    'font-picker': '/user-guide/text-editing#choose-a-font',
    'font-weight': '/user-guide/text-editing#style-text',
    'variable-fonts': '/user-guide/text-editing#fine-tune-a-variable-font',
    'font-sources': '/user-guide/text-editing#choose-a-font',
    'missing-fonts-and-substitutions': '/user-guide/text-editing#when-a-font-is-missing',
    tips: '/user-guide/text-editing#style-text'
  },
  '/user-guide/models-and-providers/': {
    'choosing-a-model': '/user-guide/models-and-providers#choose-a-model',
    'keys-and-security': '/user-guide/models-and-providers#keep-your-keys-safe'
  },
  // Was /user-guide/openpencil-cloud.
  '/cloud/': {
    'connect-a-server': '/cloud/connect',
    'your-account': '/cloud/account',
    'find-documents-on-home': '/cloud/documents#find-documents-on-home',
    'restore-a-deleted-document': '/cloud/documents#restore-a-deleted-document',
    'save-a-document-to-cloud': '/cloud/documents#save-a-document-to-cloud',
    'where-a-document-stands': '/cloud/documents#where-a-document-stands',
    'when-a-document-changed-in-two-places':
      '/cloud/documents#when-a-document-changed-in-two-places',
    'version-history': '/cloud/documents#version-history',
    'document-links': '/cloud/documents#document-links',
    'work-in-a-team-workspace': '/cloud/sharing#work-in-a-team-workspace',
    'share-a-document': '/cloud/sharing#share-a-document',
    'open-an-invitation': '/cloud/sharing#open-an-invitation',
    'edit-together': '/cloud/sharing#edit-together',
    'ai-on-cloud': '/cloud/ai'
  },
  // Was /reference/self-hosting-cloud.
  '/cloud/self-hosting/': {
    'cloudflare-workers': '/cloud/self-hosting/cloudflare',
    services: '/cloud/self-hosting/ai-services',
    email: '/cloud/self-hosting/storage-and-email#email',
    storage: '/cloud/self-hosting/storage-and-email#storage',
    'operator-commands': '/cloud/self-hosting/operations#operator-commands',
    'error-tracking': '/cloud/self-hosting/operations#error-tracking',
    'backups-and-upgrades': '/cloud/self-hosting/operations#backups-and-upgrades',
    hardening: '/cloud/self-hosting/operations#hardening'
  }
}

/** Where a page's `#section` lives now, if it moved; null when it didn't. */
export function movedSection(pathname: string, hash: string): string | null {
  const page = MOVED_SECTIONS[pathname.endsWith('/') ? pathname : `${pathname}/`]
  return page?.[decodeURIComponent(hash.replace(/^#/, ''))] ?? null
}
