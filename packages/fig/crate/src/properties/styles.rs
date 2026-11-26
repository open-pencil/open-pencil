//! Styles as the reader applies them: a record takes the fields of the styles it names
//! (`node-change/style/refs.ts`), and a claim on a text gives way to the text style it inherits
//! (`instance-overrides/style/inherited-text.ts`).

use crate::kiwi::Value;

/// The fields a text style gives a layer (`TEXT_STYLE_FIELDS`).
const TEXT_STYLE_FIELDS: &[&str] = &[
    "fontSize",
    "fontName",
    "lineHeight",
    "letterSpacing",
    "textDecoration",
    "textCase",
    "paragraphSpacing",
    "paragraphIndent",
    "listSpacing",
    "leadingTrim",
];

/// The variable fields that bind each text style field (`BINDINGS_OF_FIELD`).
fn bindings_of(field: &str) -> &'static [&'static str] {
    match field {
        "fontSize" => &["FONT_SIZE"],
        "fontName" => &["FONT_FAMILY", "FONT_STYLE"],
        "lineHeight" => &["LINE_HEIGHT"],
        "letterSpacing" => &["LETTER_SPACING"],
        "paragraphSpacing" => &["PARAGRAPH_SPACING"],
        "paragraphIndent" => &["PARAGRAPH_INDENT"],
        _ => &[],
    }
}

/// What a text style record leaves out, as Figma omits a field at its default (`STYLE_DEFAULTS`).
fn style_default(field: &str) -> Option<Value<'static>> {
    Some(match field {
        "textDecoration" | "leadingTrim" => Value::Enum(Some("NONE")),
        "textCase" => Value::Enum(Some("ORIGINAL")),
        "paragraphSpacing" | "paragraphIndent" | "listSpacing" => Value::Float(0.0),
        _ => return None,
    })
}

fn is(value: Option<&Value>, name: &str) -> bool {
    value.and_then(Value::as_str) == Some(name)
}

/// A style of the kind a reference needs, or `None`.
fn styled<'s, 'a>(style: Option<&'s Value<'a>>, kind: &str) -> Option<&'s Value<'a>> {
    style.filter(|style| is(style.get("styleType"), kind))
}

/// A text style, as `createTextStyleLookup` finds one.
pub fn text_style<'s, 'a>(style: Option<&'s Value<'a>>) -> Option<&'s Value<'a>> {
    styled(style, "TEXT").filter(|style| is(style.get("type"), "TEXT"))
}

/// Gives a record the fields of the styles it names (`applyStyleRefsToFields`). A text style
/// without a decoration clears the record's, which `top` marks as `Value::Undefined` so it
/// clears the layer below too; inside a record it is left out.
pub fn apply<'a>(
    node: &mut Value<'a>,
    style: &impl Fn(&Value<'a>) -> Option<Value<'a>>,
    top: bool,
) {
    let named = |reference: &str| node.get(reference).and_then(style);
    let fill = named("styleIdForFill");
    let stroke = named("styleIdForStrokeFill");
    let effect = named("styleIdForEffect");
    let grid = named("styleIdForGrid");
    let text = named("styleIdForText");
    let copies = [
        (fill.as_ref(), "FILL", "fillPaints", "fillPaints"),
        (stroke.as_ref(), "FILL", "fillPaints", "strokePaints"),
        (effect.as_ref(), "EFFECT", "effects", "effects"),
        (grid.as_ref(), "GRID", "layoutGrids", "layoutGrids"),
    ];
    for (style, kind, from, to) in copies {
        if let Some(value) = styled(style, kind).and_then(|style| style.get(from)) {
            node.set(to, value.clone());
        }
    }
    if let Some(style) = text_style(text.as_ref()) {
        match style.get("textDecoration") {
            Some(_) => {}
            None if top => node.set("textDecoration", Value::Undefined),
            None => super::remove(node, "textDecoration"),
        }
        for &field in TEXT_STYLE_FIELDS {
            if let Some(value) = style.get(field) {
                node.set(field, value.clone());
            }
        }
    }
}

/// Gives a record, its text's ranges (their fill style only), its vector's regions, and its
/// overrides the fields of the styles they name (`resolveStyleFields` in `document/read.ts`).
pub fn resolve<'a>(
    node: &mut Value<'a>,
    style: &impl Fn(&Value<'a>) -> Option<Value<'a>>,
    top: bool,
) {
    apply(node, style, top);
    if let Some(Value::Array(ranges)) = node
        .get_mut("textData")
        .and_then(|text| text.get_mut("styleOverrideTable"))
    {
        for range in ranges {
            let fill = range.get("styleIdForFill").and_then(style);
            if let Some(paints) =
                styled(fill.as_ref(), "FILL").and_then(|fill| fill.get("fillPaints"))
            {
                range.set("fillPaints", paints.clone());
            }
        }
    }
    if let Some(Value::Array(regions)) = node
        .get_mut("vectorData")
        .and_then(|vector| vector.get_mut("styleOverrideTable"))
    {
        for region in regions {
            apply(region, style, false);
        }
    }
    if let Some(Value::Array(overrides)) = node
        .get_mut("symbolData")
        .and_then(|data| data.get_mut("symbolOverrides"))
    {
        for entry in overrides {
            resolve(entry, style, false);
        }
    }
}

/// The variable fields a record's bindings bind.
fn bound_fields<'v>(node: &'v Value) -> Vec<&'v str> {
    super::maps::consumption(node)
        .into_iter()
        .filter_map(|entry| entry.get("variableField").and_then(Value::as_str))
        .collect()
}

fn binds(bound: &[&str], field: &str) -> bool {
    bindings_of(field)
        .iter()
        .any(|binding| bound.contains(binding))
}

/// Removes the bindings of `fields` from a record's maps, and a map left with none.
fn drop_bindings(holder: &mut Value, fields: &[&str]) {
    for map in ["variableConsumptionMap", "parameterConsumptionMap"] {
        let Some(current) = holder.get_mut(map) else {
            continue;
        };
        let Some(Value::Array(entries)) = current.get_mut("entries") else {
            super::remove(holder, map);
            continue;
        };
        entries.retain(|entry| {
            entry
                .get("variableField")
                .and_then(Value::as_str)
                .is_none_or(|field| !fields.contains(&field))
        });
        if entries.is_empty() {
            super::remove(holder, map);
        }
    }
}

/// Figma draws an inherited text style's values and bindings over those a claim saves beside it.
/// A claim touching a text style field the layer's style sets gives that field, and its bindings,
/// back to the style (`yieldToInheritedTextStyle`).
pub fn yield_to_text_style<'a>(
    props: &mut Value<'a>,
    claim: &mut Value<'a>,
    style: impl Fn(&Value<'a>) -> Option<Value<'a>>,
) {
    if claim.get("styleIdForText").is_some() {
        return;
    }
    let claim_bound = bound_fields(claim);
    let touched: Vec<&str> = TEXT_STYLE_FIELDS
        .iter()
        .copied()
        .filter(|&field| claim.get(field).is_some() || binds(&claim_bound, field))
        .collect();
    if touched.is_empty() {
        return;
    }
    let Some(reference) = props.get("styleIdForText") else {
        return;
    };
    let Some(style) = style(reference) else {
        return;
    };
    let Some(style) = text_style(Some(&style)).cloned() else {
        return;
    };
    let style_bound = bound_fields(&style);
    let value_of = |field: &str| style.get(field).cloned().or_else(|| style_default(field));
    let yielded: Vec<&str> = touched
        .into_iter()
        .filter(|&field| value_of(field).is_some() || binds(&style_bound, field))
        .collect();
    for &field in &yielded {
        super::remove(claim, field);
        if let Some(value) = value_of(field) {
            props.set(field, value);
        }
    }
    let bindings: Vec<&str> = yielded
        .iter()
        .flat_map(|field| bindings_of(field))
        .copied()
        .collect();
    drop_bindings(claim, &bindings);
    // The layer takes the style's bindings of those fields in place of its own.
    let adopted: Vec<Value<'a>> = super::maps::consumption(&style)
        .into_iter()
        .filter(|entry| {
            entry
                .get("variableField")
                .and_then(Value::as_str)
                .is_some_and(|field| bindings.contains(&field))
        })
        .cloned()
        .collect();
    drop_bindings(props, &bindings);
    if adopted.is_empty() {
        return;
    }
    let mut entries = match props
        .get("parameterConsumptionMap")
        .and_then(|map| map.get("entries"))
    {
        Some(Value::Array(entries)) => entries.clone(),
        _ => Vec::new(),
    };
    entries.extend(adopted);
    props.set(
        "parameterConsumptionMap",
        Value::Fields(vec![("entries", Value::Array(entries))]),
    );
}
