//! Network access the webview cannot do itself: proxied HTTP requests that skip CORS, and the
//! loopback port that receives the ChatGPT sign-in redirect.

pub mod http;
pub mod oauth;
