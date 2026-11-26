//! What a custom property holds as a design variable, computed by Stylo as an element inside
//! the root would compute it: a color, or a length in pixels or a number. One that is neither,
//! such as a font list or a percentage, is none.

use std::borrow::Cow;

use cssparser::Parser;
use serde_json::{Value, json};
use style::context::{QuirksMode, TreeCountingCaches};
use style::device::Device;
use style::dom::DummyElementContext;
use style::parser::{Parse, ParserContext};
use style::properties::{ComputedValues, StyleBuilder};
use style::rule_cache::RuleCacheConditions;
use style::rule_tree::RuleCascadeFlags;
use style::stylesheets::container_rule::ContainerSizeQuery;
use style::stylesheets::{CssRuleType, Origin, UrlExtraData};
use style::substitution::AttrTaint;
use style::values::computed::{Context, ToComputedValue};
use style::values::specified;
use style_traits::{ParsingMode, ToCss as _};

/// Each value as a variable's: `{ "color": "rgb(…)" }`, `{ "length": 8 }` in pixels, or
/// `{ "number": 1.5 }`; none for any other value.
pub fn typed<'a, K>(
    device: &Device,
    root: &ComputedValues,
    values: impl Iterator<Item = (K, &'a str)>,
) -> Vec<(K, Value)> {
    let url = UrlExtraData::from(url::Url::parse("about:blank").expect("a valid URL"));
    let parser = ParserContext::new(
        Origin::Author,
        &url,
        Some(CssRuleType::Style),
        ParsingMode::DEFAULT,
        QuirksMode::NoQuirks,
        Cow::default(),
        None,
        None,
        AttrTaint::default(),
    );
    let mut conditions = RuleCacheConditions::default();
    let mut caches = TreeCountingCaches::default();
    let context = Context::new(
        StyleBuilder::for_inheritance(device, None, Some(root), None),
        QuirksMode::NoQuirks,
        &mut conditions,
        ContainerSizeQuery::none(),
        RuleCascadeFlags::empty(),
        &DummyElementContext,
        &mut caches,
    );
    let color = root.get_inherited_text().color;
    values
        .filter_map(|(name, text)| {
            let value = if let Some(color_value) = parse::<specified::Color>(&parser, text) {
                let computed = color_value.to_computed_color(Some(&context)).ok()?;
                json!({ "color": computed.resolve_to_absolute(&color).to_css_string() })
            } else if let Some(number) = parse::<specified::Number>(&parser, text) {
                json!({ "number": number.to_computed_value(&context) })
            } else {
                let length = parse::<specified::Length>(&parser, text)?;
                json!({ "length": length.to_computed_value(&context).px() })
            };
            Some((name, value))
        })
        .collect()
}

fn parse<T: Parse>(context: &ParserContext, text: &str) -> Option<T> {
    Parser::new(text)
        .parse_entirely(|input| T::parse(context, input))
        .ok()
}
