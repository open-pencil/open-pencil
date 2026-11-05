Named starting points for the `grading` world effect.

A file here replaces the built-in preset of the same name, and any other file adds a new one.
Keys are the parameter names shadr exposes in the editor, in either `camelCase` or `kebab-case`.
Numbers accept the same arithmetic as a page, colours are `rrggbb`, and `tonemap` takes one of
`none`, `reinhard`, `aces`, `filmic`, `hable`.

Applying a preset writes its values into `environment.properties`; it is a starting point, not a
live link, so editing a preset afterwards does not change a grade already applied.
