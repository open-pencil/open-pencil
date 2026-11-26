//! Which custom properties each element's styles come from: the declaration that wins the
//! cascade for a property, when it is written with `var()`, with the custom properties the root
//! element declares left as references and every other one replaced by what it was set to.

use std::cell::Cell;
use std::collections::hash_map::Entry;
use std::collections::{HashMap, HashSet};
use std::rc::Rc;

use blitz_dom::{BaseDocument, Node};
use blitz_traits::node_id::NodeId;
use cssparser::{ParseError, Parser, Token, TokenSerializationType};
use serde_json::{Map, Value, json};
use style::Atom;
use style::device::Device;
use style::properties::{
    CSSWideKeyword, ComputedValues, CustomDeclarationValue, LonghandId, PropertyDeclaration,
    PropertyDeclarationBlock,
};
use style::shared_lock::SharedRwLockReadGuard;
use style_traits::ToCss as _;

/// The only text besides a reference worth inheriting: it stands for the element's `color`.
const CURRENT_COLOR: &str = "currentcolor";

/// What an element passes on to its children.
#[derive(Default, Clone)]
pub struct Scope {
    /// Winning declarations of inherited properties, expanded.
    inherited: Rc<HashMap<LonghandId, String>>,
    /// Custom properties elements below the root declare, expanded, by name without the dashes;
    /// none when only the computed value is known.
    custom: Rc<HashMap<Atom, Option<String>>>,
}

/// The custom properties the root element declares: what references are left pointing at.
pub struct Root {
    node: NodeId,
    computed: HashMap<Atom, String>,
    declared: HashMap<Atom, String>,
    /// What each computed value is as a variable's, where it is a color, length, or number.
    values: HashMap<Atom, Value>,
}

impl Root {
    pub fn of(doc: &BaseDocument, guard: &SharedRwLockReadGuard) -> Option<Self> {
        let element = doc.try_root_element()?;
        let styles = element.primary_styles()?;
        let declared = winners(&styles, guard).custom;
        let computed = declared
            .keys()
            .filter_map(|name| Some((name.clone(), custom_value(&styles, name)?)))
            .collect();
        Some(Self {
            node: element.id,
            computed,
            declared,
            values: HashMap::new(),
        })
    }

    /// Types each computed value as a variable's, in the root element's styles.
    pub fn type_values(&mut self, device: &Device, styles: &ComputedValues) {
        let texts = self
            .computed
            .iter()
            .map(|(name, text)| (name, text.as_str()));
        self.values = crate::values::typed(device, styles, texts)
            .into_iter()
            .map(|(name, value)| (name.clone(), value))
            .collect();
    }

    /// Each property, by its full name, as the root declares it, such as `var(--primary)`, with
    /// what it holds as a variable's value when it is a color, length, or number.
    pub fn to_json(&self) -> Value {
        let out: Map<String, Value> = self
            .declared
            .iter()
            .filter(|(name, _)| self.computed.contains_key(*name))
            .map(|(name, text)| {
                let mut property = String::from("--");
                let _ = serialize_name(name, &mut property);
                let mut value = json!({ "declared": text.trim() });
                if let Some(Value::Object(typed)) = self.values.get(name) {
                    value
                        .as_object_mut()
                        .into_iter()
                        .for_each(|out| out.extend(typed.clone()));
                }
                (property, value)
            })
            .collect();
        Value::Object(out)
    }
}

/// A custom property's computed value on an element.
fn custom_value(styles: &ComputedValues, name: &Atom) -> Option<String> {
    let value = styles.custom_properties().get_for_cssom(name)?;
    Some(value.to_css_string().trim().to_owned())
}

/// A custom property's name, without its dashes, as CSS writes it.
fn serialize_name(name: &Atom, out: &mut String) -> std::fmt::Result {
    cssparser::serialize_name(name, out)
}

/// What the cascade picked for an element: a longhand's text when it is written with `var()` or
/// is `currentcolor`, and none when something else won; and custom properties as declared.
#[derive(Default)]
struct Winners {
    longhands: HashMap<LonghandId, Option<String>>,
    custom: HashMap<Atom, String>,
    /// Custom properties set back to their initial value.
    reset: HashSet<Atom>,
    /// Longhands that take the parent's value.
    inherits: HashSet<LonghandId>,
}

fn winners(styles: &ComputedValues, guard: &SharedRwLockReadGuard) -> Winners {
    let mut found = Winners::default();
    let mut decided_custom: HashSet<Atom> = HashSet::new();
    // From the rule that wins to those it overrides; within a block, the later declaration wins.
    for rule in styles.rules().self_and_ancestors() {
        let Some(source) = rule.style_source() else {
            continue;
        };
        let important = rule.importance().important();
        let block = source.read(guard);
        for (declaration, importance) in block.declaration_importance_iter().rev() {
            if importance.important() != important {
                continue;
            }
            match declaration {
                PropertyDeclaration::Custom(custom) => {
                    if !decided_custom.insert(custom.name.clone()) {
                        continue;
                    }
                    match &custom.value {
                        CustomDeclarationValue::Unparsed(value) => {
                            found.custom.insert(custom.name.clone(), value.css.clone());
                        }
                        CustomDeclarationValue::Parsed(value) => {
                            found
                                .custom
                                .insert(custom.name.clone(), value.to_css_string());
                        }
                        CustomDeclarationValue::CSSWideKeyword(
                            CSSWideKeyword::Inherit | CSSWideKeyword::Unset,
                        ) => {}
                        CustomDeclarationValue::CSSWideKeyword(_) => {
                            found.reset.insert(custom.name.clone());
                        }
                    }
                }
                PropertyDeclaration::WithVariables(_) => {
                    if let Some(id) = declaration.id().as_longhand() {
                        found
                            .longhands
                            .entry(id.to_physical(styles.writing_mode))
                            .or_insert_with(|| variable_text(block, declaration, id));
                    }
                }
                PropertyDeclaration::CSSWideKeyword(wide) => {
                    if let Some(id) = declaration.id().as_longhand() {
                        let id = id.to_physical(styles.writing_mode);
                        let inherits = match wide.keyword {
                            CSSWideKeyword::Inherit => true,
                            CSSWideKeyword::Unset => id.inherited(),
                            _ => false,
                        };
                        if let Entry::Vacant(entry) = found.longhands.entry(id) {
                            entry.insert(None);
                            if inherits {
                                found.inherits.insert(id);
                            }
                        }
                    }
                }
                _ => {
                    if let Some(id) = declaration.id().as_longhand() {
                        let id = id.to_physical(styles.writing_mode);
                        found.longhands.entry(id).or_insert_with(|| {
                            let mut text = String::new();
                            let _ = declaration.to_css(&mut text);
                            text.eq_ignore_ascii_case(CURRENT_COLOR)
                                .then(|| CURRENT_COLOR.to_owned())
                        });
                    }
                }
            }
        }
    }
    found
}

/// A declaration's text as written; one that comes from a shorthand has the shorthand's.
fn variable_text(
    block: &PropertyDeclarationBlock,
    declaration: &PropertyDeclaration,
    id: LonghandId,
) -> Option<String> {
    let mut text = String::new();
    let _ = declaration.to_css(&mut text);
    if !text.is_empty() {
        return Some(text);
    }
    id.shorthands().find_map(|shorthand| {
        let mut text = String::new();
        let _ = block.shorthand_to_css(shorthand, &mut text);
        (!text.is_empty()).then_some(text)
    })
}

/// A page can write properties that double at every step, so expansion has limits far past what
/// design systems write; a value over them is left without a reference.
const EXPANSIONS: u32 = 20_000;
const MAX_EXPANDED: usize = 64 * 1024;

/// Keeps two tokens from reading as one.
fn separate(out: &mut String, previous: TokenSerializationType, next: TokenSerializationType) {
    if previous.needs_separator_when_before(next) {
        out.push(' ');
    }
}

/// How the first and the last token of a value join with what is around them.
fn outer_tokens(text: &str) -> Option<(TokenSerializationType, TokenSerializationType)> {
    let mut input = Parser::new(text);
    let mut ends = None;
    while let Ok(token) = input.next_including_whitespace_and_comments() {
        let first = token.serialization_type();
        let last = match token {
            Token::Function(_)
            | Token::ParenthesisBlock
            | Token::SquareBracketBlock
            | Token::CurlyBracketBlock => TokenSerializationType::Other,
            _ => first,
        };
        ends = Some((ends.map_or(first, |(first, _)| first), last));
    }
    ends
}

/// Replaces `var()` in a value: one that names a custom property the element takes from the root
/// unchanged stays, one set nearer by becomes what it was set to, and one set nowhere its fallback.
struct Expander<'a> {
    doc: &'a BaseDocument,
    node: NodeId,
    root: &'a Root,
    is_root: bool,
    /// How many more `var()` the element's values may expand.
    budget: Cell<u32>,
    styles: &'a ComputedValues,
    /// What the cascade picked for the element itself.
    won: &'a Winners,
    inherited: &'a HashMap<Atom, Option<String>>,
}

impl Expander<'_> {
    fn expand(&self, text: &str, visiting: &mut Vec<Atom>) -> Option<String> {
        let mut out = String::new();
        self.write(&mut Parser::new(text), &mut out, visiting)
            .then(|| out.trim().to_owned())
    }

    fn write(&self, input: &mut Parser<'_>, out: &mut String, visiting: &mut Vec<Atom>) -> bool {
        let mut previous = TokenSerializationType::Nothing;
        while let Ok(token) = input.next_including_whitespace_and_comments() {
            let token = token.clone();
            let closing = match &token {
                Token::Function(name) if name.eq_ignore_ascii_case("var") => {
                    let replaced = input.parse_nested_block(|block| {
                        let name = block.expect_ident().map_err(ParseError::<()>::from)?;
                        let name = Atom::from(name.strip_prefix("--").unwrap_or_default());
                        let comma = block.try_parse(|rest| rest.expect_comma()).is_ok();
                        let start = block.position();
                        while block.next_including_whitespace_and_comments().is_ok() {}
                        let fallback = comma.then(|| block.slice_from(start).to_owned());
                        Ok((name, fallback))
                    });
                    let Ok((name, fallback)) = replaced else {
                        return false;
                    };
                    let Some(text) = self.variable(&name, fallback.as_deref(), visiting) else {
                        return false;
                    };
                    // Substituted tokens stay apart from those around them.
                    if let Some((first, last)) = outer_tokens(&text) {
                        separate(out, previous, first);
                        previous = last;
                    }
                    out.push_str(&text);
                    if out.len() > MAX_EXPANDED {
                        return false;
                    }
                    continue;
                }
                Token::Function(_) | Token::ParenthesisBlock => ")",
                Token::SquareBracketBlock => "]",
                Token::CurlyBracketBlock => "}",
                // A comment can be all that keeps two tokens apart.
                Token::Comment(_) => {
                    out.push(' ');
                    previous = TokenSerializationType::WhiteSpace;
                    continue;
                }
                _ => {
                    separate(out, previous, token.serialization_type());
                    previous = token.serialization_type();
                    let _ = cssparser::ToCss::to_css(&token, out);
                    continue;
                }
            };
            separate(out, previous, token.serialization_type());
            previous = TokenSerializationType::Other;
            let _ = cssparser::ToCss::to_css(&token, out);
            let mut complete = true;
            let _ = input.parse_nested_block(|block| {
                complete = self.write(block, out, visiting);
                Ok::<(), ParseError<()>>(())
            });
            if !complete {
                return false;
            }
            out.push_str(closing);
        }
        true
    }

    fn variable(
        &self,
        name: &Atom,
        fallback: Option<&str>,
        visiting: &mut Vec<Atom>,
    ) -> Option<String> {
        self.budget.set(self.budget.get().checked_sub(1)?);
        let Some(value) = custom_value(self.styles, name) else {
            // One registered with `@property` has its initial value.
            let mut property = String::from("--");
            let _ = serialize_name(name, &mut property);
            let initial = self.doc.resolved_style_value(self.node, &property);
            return match (initial.trim(), fallback) {
                ("", fallback) => self.expand(fallback?, visiting),
                (initial, _) => Some(initial.to_owned()),
            };
        };
        // What the element or one between it and the root declares is its own, even when it
        // holds the root's value.
        if !self.is_root {
            if let Some(declared) = self.won.custom.get(name) {
                if visiting.contains(name) {
                    return None;
                }
                visiting.push(name.clone());
                let expanded = self.expand(declared, visiting);
                visiting.pop();
                return expanded;
            }
            if self.won.reset.contains(name) {
                return Some(value);
            }
            if let Some(text) = self.inherited.get(name) {
                return Some(text.clone().unwrap_or(value));
            }
        }
        if self.root.computed.get(name) == Some(&value) {
            let mut reference = String::from("var(--");
            let _ = serialize_name(name, &mut reference);
            reference.push(')');
            return Some(reference);
        }
        Some(value)
    }
}

/// The element's properties whose values come from the root's custom properties, by name, as
/// written once expanded; and what its children inherit.
pub fn of(
    doc: &BaseDocument,
    node: &Node,
    root: &Root,
    scope: &Scope,
    guard: &SharedRwLockReadGuard,
    properties: &[&str],
) -> (Value, Scope) {
    let Some(styles) = node.primary_styles() else {
        return (Value::Object(Map::new()), scope.clone());
    };
    let won = winners(&styles, guard);
    let expander = Expander {
        doc,
        node: node.id,
        root,
        is_root: node.id == root.node,
        budget: Cell::new(EXPANSIONS),
        styles: &styles,
        won: &won,
        inherited: &scope.custom,
    };
    let mut inherited = (*scope.inherited).clone();
    let mut texts: HashMap<LonghandId, String> = HashMap::new();
    for (id, text) in &won.longhands {
        if won.inherits.contains(id) {
            if let Some(text) = scope.inherited.get(id) {
                texts.insert(*id, text.clone());
            }
            continue;
        }
        let text = text
            .as_deref()
            .and_then(|text| expander.expand(text, &mut Vec::new()))
            .filter(|text| text.contains("var(") || text.eq_ignore_ascii_case(CURRENT_COLOR));
        if id.inherited() {
            inherited.remove(id);
        }
        if let Some(text) = text {
            texts.insert(*id, text);
        }
    }
    for (id, text) in &texts {
        if id.inherited() {
            inherited.insert(*id, text.clone());
        }
    }
    // `color: currentcolor` is the parent's color.
    if inherited.get(&LonghandId::Color).map(String::as_str) == Some(CURRENT_COLOR) {
        match scope.inherited.get(&LonghandId::Color) {
            Some(text) => inherited.insert(LonghandId::Color, text.clone()),
            None => inherited.remove(&LonghandId::Color),
        };
    }
    let color = inherited.get(&LonghandId::Color);

    let mut out = Map::new();
    for property in properties {
        let Some(id) = longhand(property) else {
            continue;
        };
        let text = match texts.get(&id) {
            Some(text) => Some(text),
            None if id.inherited() => inherited.get(&id),
            None if CURRENT_BY_DEFAULT.contains(&id) && !won.longhands.contains_key(&id) => color,
            None => None,
        };
        let text = match text.map(String::as_str) {
            Some(CURRENT_COLOR) => color.map(String::as_str),
            other => other,
        };
        if let Some(text) = text {
            out.insert((*property).to_owned(), text.into());
        }
    }

    let passed = Scope {
        inherited: if inherited == *scope.inherited {
            scope.inherited.clone()
        } else {
            Rc::new(inherited)
        },
        custom: passed_custom(&expander, scope),
    };
    (Value::Object(out), passed)
}

/// The custom properties an element passes on: those it inherits, with what it declares itself.
fn passed_custom(expander: &Expander, scope: &Scope) -> Rc<HashMap<Atom, Option<String>>> {
    let won = expander.won;
    if expander.is_root || (won.custom.is_empty() && won.reset.is_empty()) {
        return scope.custom.clone();
    }
    let mut custom = (*scope.custom).clone();
    for name in &won.reset {
        custom.insert(name.clone(), None);
    }
    for (name, declared) in &won.custom {
        // A registered property may not inherit, and leaves what children see as it was.
        if expander
            .styles
            .custom_properties()
            .inherited
            .get(name)
            .is_some()
        {
            let text = expander.expand(declared, &mut vec![name.clone()]);
            custom.insert(name.clone(), text);
        }
    }
    Rc::new(custom)
}

/// Colors that are the element's `color` until something sets them.
const CURRENT_BY_DEFAULT: &[LonghandId] = &[
    LonghandId::BorderTopColor,
    LonghandId::BorderRightColor,
    LonghandId::BorderBottomColor,
    LonghandId::BorderLeftColor,
    LonghandId::OutlineColor,
    LonghandId::TextDecorationColor,
];

fn longhand(property: &str) -> Option<LonghandId> {
    use style::properties::PropertyId;
    let id = PropertyId::parse_enabled_for_all_content(property).ok()?;
    id.longhand_id()
}
