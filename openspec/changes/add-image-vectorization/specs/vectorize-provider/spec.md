## ADDED Requirements

### Requirement: Vectorization provider is selectable, defaulting to Recraft
The settings SHALL let the user choose the vectorization provider from Recraft and fal. The default provider SHALL be Recraft. The chosen provider SHALL persist locally and SHALL determine which vendor a "Convert to Vector" call is sent to.

#### Scenario: Default provider
- **WHEN** the user has never chosen a vectorization provider
- **THEN** the active provider is Recraft

#### Scenario: Switching provider persists
- **WHEN** the user selects fal as the vectorization provider
- **THEN** subsequent conversions are sent to fal
- **AND** the choice is retained across reloads

### Requirement: Each provider's API key is stored locally via the key-field pattern
Each vectorization provider SHALL have its own API key field, entered through the existing non-LLM key-field settings pattern (as used for the stock-photo keys), and stored in local storage independently of the AI chat provider keys. Keys SHALL persist across reloads and SHALL be clearable. The vectorization keys SHALL NOT participate in the AI chat provider (`AI_PROVIDERS`) flow.

#### Scenario: Enter and persist a provider key
- **WHEN** the user enters and saves a key for the active vectorization provider
- **THEN** the key is stored locally and remains available after reload
- **AND** the field indicates a key is saved

#### Scenario: Keys are per-provider
- **WHEN** the user has saved a Recraft key and switches the provider to fal
- **THEN** the fal key field reflects only the fal key (the Recraft key is not shown for fal)

#### Scenario: Clearing a key
- **WHEN** the user clears the active provider's key
- **THEN** the stored key for that provider is removed

### Requirement: Convert requires a configured key for the active provider
A "Convert to Vector" action SHALL only proceed when the active provider has a key configured. If no key is configured, the conversion SHALL NOT alter the canvas and the user SHALL be guided to add a key.

#### Scenario: No key configured
- **WHEN** the user runs "Convert to Vector" while the active provider has no key
- **THEN** the canvas is left unchanged
- **AND** the user is prompted to add the provider's API key
