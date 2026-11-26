//! Network access the webview cannot do itself: proxied HTTP requests that skip CORS, the loopback
//! port that receives the ChatGPT sign-in redirect, and pages rendered in a hidden webview. A web
//! page's own requests reach only the addresses its own address allows (`address`).

pub mod address;
pub mod http;
pub mod oauth;
pub mod page;
