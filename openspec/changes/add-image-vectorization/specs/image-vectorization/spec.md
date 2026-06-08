# Image vectorization — spec delta

## ADDED Requirements

### Requirement: Convert to Vector is offered only for a single image node
The canvas context menu SHALL show a "Convert to Vector" action when exactly one node is selected and that node has an `IMAGE` fill. The action SHALL NOT appear for multi-selection, for nodes without an `IMAGE` fill, or when nothing is selected.

#### Scenario: Single image node selected
- **WHEN** the user right-clicks a single selected node that has an `IMAGE` fill
- **THEN** the context menu includes a "Convert to Vector" action

#### Scenario: Non-image or multi-selection
- **WHEN** the selection is empty, contains more than one node, or the single selected node has no `IMAGE` fill
- **THEN** the context menu does not include "Convert to Vector"

### Requirement: Converting replaces the image with editable vector nodes
Invoking "Convert to Vector" SHALL send the image to the configured vectorization provider and replace the original image node with editable `VECTOR` node(s) parsed from the returned SVG. The replacement SHALL occupy the original node's position and size, under the original node's parent, and the original image node SHALL no longer exist.

#### Scenario: Image becomes editable vectors
- **WHEN** the user runs "Convert to Vector" on an image node and the provider returns an SVG
- **THEN** the image node is removed and replaced by `VECTOR` node(s) carrying the SVG paths
- **AND** the result occupies the same position and size as the original image
- **AND** the new vector node(s) are selected

#### Scenario: Result renders 1:1 with the input
- **WHEN** the conversion completes
- **THEN** the vectorized result is rendered at the original image's pixel dimensions (no scale shift)

### Requirement: Conversion is a single undoable operation
The image-to-vector replacement SHALL be undoable and redoable as one step. A single undo SHALL restore the original image node exactly as it was, and a single redo SHALL reapply the vectorized result.

#### Scenario: Undo restores the original image
- **WHEN** the user converts an image to vectors and then undoes once
- **THEN** the original image node is restored at its original position and size
- **AND** the vector node(s) created by the conversion are removed

### Requirement: Small inputs are upscaled to meet the provider minimum dimension
Before sending, an image whose shorter side is below the provider's minimum input dimension (256px) SHALL be upscaled so the shorter side meets the minimum, preserving transparency. Images already at or above the minimum SHALL be sent without upscaling.

#### Scenario: Sub-256px image is upscaled
- **WHEN** the selected image's shorter side is less than 256px
- **THEN** the image is upscaled so its shorter side is at least 256px before being sent
- **AND** transparency in the original image is preserved in the result

#### Scenario: Large enough image is sent unchanged
- **WHEN** the selected image's shorter side is 256px or greater
- **THEN** the image is sent without upscaling

### Requirement: Conversion progress and failure are surfaced
While a conversion is in flight the action SHALL be prevented from starting a second conversion, and the user SHALL receive progress feedback. On success the user SHALL be notified; on failure (missing key, provider error, network error) the canvas SHALL be left unchanged and the user SHALL be shown an error message.

#### Scenario: In-progress feedback and success
- **WHEN** a conversion starts
- **THEN** the user sees an in-progress indication
- **AND** on completion the user sees a success indication and the canvas shows the vectors

#### Scenario: Failure leaves the canvas unchanged
- **WHEN** the provider call fails (e.g. no key configured, or a network/provider error)
- **THEN** the original image node remains unchanged
- **AND** the user is shown an error message describing the failure
