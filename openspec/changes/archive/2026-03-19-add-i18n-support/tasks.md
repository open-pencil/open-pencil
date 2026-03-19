## 1. Setup and Dependencies

- [x] 1.1 Install vue-i18n dependency (`bun add vue-i18n`)
- [x] 1.2 Create `src/locales/` directory structure
- [x] 1.3 Create TypeScript type definition for locale schema (`src/locales/types.ts`)

## 2. Framework Integration

- [x] 2.1 Create i18n instance configuration (`src/i18n/index.ts`)
- [x] 2.2 Create `useI18n` composable with language detection (`src/composables/use-i18n.ts`)
- [x] 2.3 Create `detectSystemLocale()` function with browser/Tauri detection
- [x] 2.4 Create `mapToSupportedLocale()` function for language mapping
- [x] 2.5 Create `setLocale()` function with localStorage persistence
- [x] 2.6 Register vue-i18n plugin in `src/main.ts`
- [x] 2.7 Configure fallback locale to 'en'

## 3. Translation Files (English Base)

- [x] 3.1 Create `src/locales/en.json` with complete English translations
- [x] 3.2 Add menu translations (File, Edit, View, etc.)
- [x] 3.3 Add toolbar translations (tools, actions)
- [x] 3.4 Add properties panel translations (tabs, sections, labels)
- [x] 3.5 Add panels translations (Layers, Pages)
- [x] 3.6 Add dialog translations (Variables, Confirm, Permission)
- [x] 3.7 Add context menu translations
- [x] 3.8 Add toast/error message translations
- [x] 3.9 Add tooltip translations

## 4. Translation Files (Other Languages)

- [x] 4.1 Create `src/locales/zh-CN.json` (Simplified Chinese)
- [x] 4.2 Create `src/locales/zh-TW.json` (Traditional Chinese)
- [x] 4.3 Create `src/locales/fr.json` (French)
- [x] 4.4 Create `src/locales/ko.json` (Korean)
- [x] 4.5 Create `src/locales/ja.json` (Japanese)
- [x] 4.6 Create `src/locales/de.json` (German)
- [x] 4.7 Create `src/locales/it.json` (Italian)
- [x] 4.8 Create `src/locales/ru.json` (Russian)

## 5. Language Selector Component

- [x] 5.1 Create `src/components/LanguageSelector.vue` component
- [x] 5.2 Add language list with native names and flags
- [x] 5.3 Implement language switch functionality
- [x] 5.4 Add checkmark for current language

## 6. Component Migration - Menu

- [x] 6.1 Update `src/components/AppMenu.vue` to use `$t()` for all menu items
- [x] 6.2 Add Language submenu with LanguageSelector integration
- [x] 6.3 Translate all menu shortcuts hints (keep shortcuts as symbols)

## 7. Component Migration - Toolbar

- [x] 7.1 Update `src/components/Toolbar.vue` tool labels to use `$t()`
- [x] 7.2 Translate edit actions (Copy, Paste, Cut, etc.)
- [x] 7.3 Translate arrange actions (Front, Back, Group, etc.)

## 8. Component Migration - Properties Panel

- [x] 8.1 Update `src/components/PropertiesPanel.vue` tab names
- [x] 8.2 Update `src/components/DesignPanel.vue` section titles
- [x] 8.3 Update `src/components/properties/LayoutSection.vue` labels
- [x] 8.4 Update `src/components/properties/AppearanceSection.vue` labels
- [x] 8.5 Update `src/components/properties/FillSection.vue` labels
- [x] 8.6 Update `src/components/properties/StrokeSection.vue` labels
- [x] 8.7 Update `src/components/properties/EffectsSection.vue` labels
- [x] 8.8 Update `src/components/properties/TypographySection.vue` labels
- [x] 8.9 Update `src/components/properties/PositionSection.vue` labels
- [x] 8.10 Update `src/components/properties/PageSection.vue` labels
- [x] 8.11 Update `src/components/properties/VariablesSection.vue` labels
- [x] 8.12 Update `src/components/properties/ExportSection.vue` labels

## 9. Component Migration - Side Panels

- [x] 9.1 Update `src/components/LayersPanel.vue` header title
- [x] 9.2 Update `src/components/PagesPanel.vue` header and button tooltips
- [x] 9.3 Update `src/components/LayerTree.vue` tooltips

## 10. Component Migration - Dialogs

- [x] 10.1 Update `src/components/VariablesDialog.vue` titles and buttons
- [x] 10.2 Update `src/components/chat/ACPPermissionDialog.vue` text
- [x] 10.3 Update any confirm dialogs with translated text

## 11. Component Migration - Context Menus

- [x] 11.1 Update `src/components/NodeContextMenuContent.vue` menu items
- [x] 11.2 Update `src/components/CanvasContextMenu.vue` menu items

## 12. Component Migration - Chat Panel

- [x] 12.1 Update `src/components/ChatPanel.vue` input placeholder
- [x] 12.2 Update `src/components/chat/ChatInput.vue` labels
- [x] 12.3 Update `src/components/chat/ProviderSelect.vue` labels
- [x] 12.4 Update `src/components/chat/ProviderSetup.vue` labels
- [x] 12.5 Update `src/components/chat/ProviderSettings.vue` labels

## 13. Component Migration - Other

- [x] 13.1 Update `src/components/AppToast.vue` message translations
- [x] 13.2 Update `src/components/SafariBanner.vue` warning text
- [x] 13.3 Update `src/components/FillPicker.vue` tooltips
- [x] 13.4 Update `src/components/ColorPicker.vue` labels
- [x] 13.5 Update `src/components/FontPicker.vue` labels
- [x] 13.6 Update `src/components/CodePanel.vue` button labels

## 14. Testing and Validation

- [x] 14.1 Test language auto-detection in browser
- [x] 14.2 Test language auto-detection in Tauri desktop
- [x] 14.3 Test language switching via menu
- [x] 14.4 Test language persistence across reloads
- [x] 14.5 Verify all components update text on language change
- [x] 14.6 Verify fallback to English for missing translations
- [x] 14.7 Run `bun run check` to verify no type errors
- [x] 14.8 Run `bun run test` to verify no visual regressions

## 15. Documentation

- [x] 15.1 Update `CHANGELOG.md` with i18n feature
- [x] 15.2 Update `README.md` with supported languages list
- [x] 15.3 Add translation guide to `packages/docs/`