## ADDED Requirements

### Requirement: Vue I18n integration in components
All UI components SHALL use vue-i18n for text display, replacing hardcoded strings with `$t()` calls or `useI18n().t()`.

#### Scenario: Component uses translation function
- **WHEN** a component renders text content
- **THEN** the text SHALL be retrieved via `$t('key.path')` or `t('key.path')`
- **AND** the text SHALL update immediately when locale changes

#### Scenario: Template interpolation
- **WHEN** a component needs dynamic text (e.g., "Page 1 of 5")
- **THEN** the component SHALL use vue-i18n interpolation syntax: `$t('key', { count: 5 })`

### Requirement: Translation key namespace
Translation keys SHALL follow a hierarchical namespace based on component location.

#### Scenario: Menu keys namespace
- **WHEN** translating menu items
- **THEN** keys SHALL use `menu.<submenu>.<item>` format
- **AND** example: `menu.file.new`, `menu.edit.undo`

#### Scenario: Panel keys namespace
- **WHEN** translating panel content
- **THEN** keys SHALL use `panels.<panel>.<section>.<item>` format
- **AND** example: `panels.properties.design`, `panels.layers.title`

#### Scenario: Dialog keys namespace
- **WHEN** translating dialog content
- **THEN** keys SHALL use `dialogs.<dialog>.<item>` format
- **AND** example: `dialogs.variables.title`, `dialogs.confirm.ok`

### Requirement: Language selector in AppMenu
The AppMenu SHALL include a Language submenu listing all supported languages with the current selection checked.

#### Scenario: Language submenu display
- **WHEN** user opens the AppMenu
- **THEN** a "Language" submenu SHALL be visible
- **AND** clicking opens a submenu with all 9 languages
- **AND** the current language SHALL be checked

#### Scenario: Language switch
- **WHEN** user selects a different language from the submenu
- **THEN** all UI text SHALL update immediately
- **AND** the selection SHALL be saved to localStorage

### Requirement: RTL layout preparation (future)
Translation keys SHALL be structured to support RTL languages in future, even though RTL is not currently implemented.

#### Scenario: Bidirectional text support
- **WHEN** a RTL language is added in future
- **THEN** existing translation structure SHALL remain valid
- **AND** only CSS direction changes SHALL be needed