## ADDED Requirements

### Requirement: Component type mapping in export
The .fig export pipeline SHALL map COMPONENT and COMPONENT_SET node types to SYMBOL in Kiwi encoding (Figma uses SYMBOL enum value for component-like nodes).

#### Scenario: Exporting component
- **WHEN** a COMPONENT node is serialized to Kiwi format
- **THEN** the type field uses the SYMBOL enum value

#### Scenario: Exporting component set
- **WHEN** a COMPONENT_SET node is serialized to Kiwi format
- **THEN** the type field uses the SYMBOL enum value

#### Scenario: Round-trip fidelity
- **WHEN** an exported .fig file is re-imported in Figma
- **THEN** component nodes are recognized as components (not unknown types)
