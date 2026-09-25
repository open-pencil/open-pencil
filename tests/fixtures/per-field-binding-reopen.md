# Per-field binding inheritance

The inherited-expression fixture receives a placed left-padding binding to direct token12
and a definition-level right-padding binding to inherited token20. After synchronization,
left padding is6 and right padding5; outer width36 and nested width16.

Export reopened in Figma retains those values. Changing the inherited token20→40 changes
right padding5→10 and outer width36→41, while explicitly bound left padding stays6. The token
is restored20. `per-field-binding-reopen.json` records both observations.

SceneGraph synchronization merges bindings and conversion factors per field. Whole-map
legacy protection remains effective when declared by an owner without per-field claims.
Another owner's per-field claims must not weaken that protection; synthetic regression tests
cover both outer-owner and self-owner combinations. The mixed legacy test is a SceneGraph
provenance contract, not a claim that Figma writes the same internal protection representation.

No pixel oracle is provided for this case. Explicit unbinding and later inheritance of another
field are covered locally, not by this external reopen capture.
