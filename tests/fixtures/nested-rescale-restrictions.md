# Native nested rescale restrictions

`nested-rescale-restrictions.json` records native Figma Plugin API probes against the
placed-owner rescale acceptance document. Calling `rescale(1)` on either its nested instance
or rectangle descendant throws `This property cannot be overridden in an instance: size`.
A prior `rescale(2)` probe on a cloned placed owner's nested instance throws the same error.

A separate clone of the outer component definition permits rescaling its nested instance by
2: width25→50, height14→28, bound left padding10→20. These are different contexts: a child
inside a definition is not an override of a placed occurrence.

OpenPencil's Figma API rejects rescale on occurrence descendants before mutation and permits
rescale inside component definitions. The format-neutral SceneGraph scaling operation is not
restricted by this Plugin API policy. Tests cover unchanged rejected targets and allowed
component-definition children. This evidence does not establish definition-edit propagation,
export, or reparenting fidelity.
