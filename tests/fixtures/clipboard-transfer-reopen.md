# Clipboard transfer external reopen

A captured nested instance is encoded as Figma clipboard HTML, pasted through the real editor
into a fresh graph, and exported as a document. Reopened Figma reports outer33.5×7, nested
width13.5, and left padding6 with a direct alias to the remapped variable. Changing token12→16
gives outer35.5, nested15.5, and left8. The token is restored12.

`clipboard-transfer-reopen.json` records those native observations. Figma renames the placed
root to `Outer` on reopen, dropping the custom `Clipboard acceptance` name. This is not name
preservation acceptance. This test exercises encoded clipboard import plus exported-document
reopen, not trusted operating-system clipboard events or native copy/paste UI.

Editor engine tests cover ordinary paste and paste-to-replace, owned hidden definitions and
variables through undo/redo, post-placement coordinates, committed observer errors, and a redo
identity collision leaving the original replacement target intact. Mutation failures during
original-target deletion and resource reuse beyond these tests remain separate gaps.
