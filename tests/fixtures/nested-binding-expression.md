# Saved inherited binding expressions

The source is `nested-binding-ownership-records.json`, with only the placed owner's direct
padding declaration removed by the shared test helper. The canonical child retains Figma's
saved `MULTIPLY(0.5, alias)` expression. Unlike the earlier synthetic inheritance test, this
fixture does not remove that expression.

An independent native Figma instance has nested padding 5 and outer width 32.5 at token 20.
Changing the token to 40 gives padding 10 and width 37.5. This horizontal probe uses the earlier
component-edit document; its changed top padding is not compared with the original fixture's
vertical geometry. The reopened document and PNG below use the original fixture's top padding.
The expression is in its own record's
placed units: its coefficient must not be multiplied by the same instance scale again. The
outer occurrence's 0.5 factor still applies, giving a final binding multiplier of 0.25.

OpenPencil edits the token to 40 and re-encodes the document. Reopened Figma reports padding 10,
nested width 17.5, and outer size 37.5×7. Changing the reopened token to 60 gives padding 15 and
outer width 42.5, proving the expression remains live. It is restored to 40 before PNG capture.
Figma's `boundVariables` projection is empty for this inherited expression; that does not mean
it is unbound. Captures are in `nested-binding-expression.json`.

`nested-binding-expression-figma.png` is the reopened 8× Figma export (300×56). Headless tests
edit the imported token to 60 and back to 40 and compare exact decoded sRGB RGBA pixels. A
separate browser snapshot covers the before/after geometry projection. Engine tests cover
editor history, same-alias rebinding, and local edited re-encoding.

Acceptance is limited to products of finite constants and one alias, including nested products.
Other operators, multiple-alias products, and constant-only binding expressions are not accepted;
they fail explicitly instead of silently losing a binding. This does not establish all expression
forms, arbitrary expression/component-edit interactions, typography, or rescale/export lifecycle.
