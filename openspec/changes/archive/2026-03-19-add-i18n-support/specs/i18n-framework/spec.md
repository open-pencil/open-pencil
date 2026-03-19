## ADDED Requirements

### Requirement: Vue I18n framework integration
The system SHALL integrate vue-i18n as the internationalization framework with proper TypeScript configuration.

#### Scenario: Vue I18n plugin installed
- **WHEN** the application starts
- **THEN** vue-i18n plugin SHALL be registered with Vue app
- **AND** i18n instance SHALL be available globally

#### Scenario: TypeScript type safety
- **WHEN** developer uses `$t()` function
- **THEN** TypeScript SHALL provide autocomplete for translation keys
- **AND** TypeScript SHALL report errors for invalid keys

### Requirement: Language file organization
The system SHALL organize translation files by language code in `src/locales/` directory.

#### Scenario: Language file structure
- **WHEN** the system loads
- **THEN** translation files SHALL exist for all supported languages: en, zh-CN, zh-TW, fr, ko, ja, de, it, ru
- **AND** each file SHALL be valid JSON
- **AND** all files SHALL share the same schema structure

### Requirement: Automatic language detection
The system SHALL automatically detect and apply the user's preferred language on first visit.

#### Scenario: Detect browser language
- **WHEN** user visits the application for the first time
- **AND** localStorage has no language preference
- **THEN** system SHALL detect `navigator.language`
- **AND** system SHALL map detected language to supported language

#### Scenario: Language mapping
- **WHEN** detected language is `zh`, `zh-CN`, or `zh-Hans`
- **THEN** system SHALL use `zh-CN` (Simplified Chinese)
- **WHEN** detected language is `zh-TW`, `zh-HK`, or `zh-Hant`
- **THEN** system SHALL use `zh-TW` (Traditional Chinese)
- **WHEN** detected language is not supported
- **THEN** system SHALL fallback to `en` (English)

#### Scenario: Detect Tauri system language
- **WHEN** running in Tauri desktop environment
- **AND** localStorage has no language preference
- **THEN** system SHALL detect OS locale via Tauri API
- **AND** system SHALL map to supported language

### Requirement: User language preference persistence
The system SHALL persist user's language preference in localStorage.

#### Scenario: Save language preference
- **WHEN** user selects a language
- **THEN** system SHALL save the selected language code to localStorage key `openpencil-language`

#### Scenario: Load saved language preference
- **WHEN** user visits the application
- **AND** localStorage contains `openpencil-language`
- **THEN** system SHALL use the saved language
- **AND** system SHALL NOT override with auto-detected language

### Requirement: Language switching
The system SHALL allow users to switch language at runtime with immediate effect.

#### Scenario: Language switch via menu
- **WHEN** user selects a different language from AppMenu
- **THEN** system SHALL update all visible text immediately
- **AND** system SHALL save the new preference to localStorage

#### Scenario: Language switch persistence
- **WHEN** user reloads the page after switching language
- **THEN** system SHALL display in the previously selected language

### Requirement: Fallback locale
The system SHALL fallback to English when a translation is missing.

#### Scenario: Missing translation fallback
- **WHEN** a translation key is not found in the current locale
- **THEN** system SHALL display the English translation
- **AND** system SHALL NOT display the raw translation key

### Requirement: i18n composable
The system SHALL provide a composable function for accessing i18n features.

#### Scenario: useI18n composable
- **WHEN** component calls `useI18n()`
- **THEN** composable SHALL return `{ t, locale, setLocale, availableLocales }`
- **AND** `t` SHALL be the translation function
- **AND** `locale` SHALL be reactive current locale
- **AND** `setLocale` SHALL switch locale
- **AND** `availableLocales` SHALL list all supported languages

### Requirement: Language selector component
The system SHALL provide a UI component for language selection.

#### Scenario: Language selector in menu
- **WHEN** user opens AppMenu
- **THEN** "Language" submenu SHALL be visible
- **AND** submenu SHALL list all supported languages
- **AND** current language SHALL be checked

#### Scenario: Language names display
- **WHEN** language selector displays language options
- **THEN** each language SHALL show its native name:
  - English → "English"
  - 简体中文 → "简体中文"
  - 繁體中文 → "繁體中文"
  - Français → "Français"
  - 한국어 → "한국어"
  - 日本語 → "日本語"
  - Deutsch → "Deutsch"
  - Italiano → "Italiano"
  - Русский → "Русский"