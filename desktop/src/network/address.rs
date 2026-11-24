//! Which addresses a request a web page asks for may reach. A page on the public internet reaches
//! only public addresses, as browsers keep public sites from reaching private networks: an imported
//! page cannot make the app fetch from the user's own machine or local network. A page whose
//! own address is local, such as a development server's, reaches both.

use std::io;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};

use reqwest::dns::{Addrs, Name, Resolve, Resolving};
use reqwest::Url;

/// Whether `ip` is on the public internet: not this machine, a private or link-local network,
/// shared carrier space, multicast, or a reserved range.
pub fn is_public(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => is_public_v4(ip),
        IpAddr::V6(ip) => is_public_v6(ip),
    }
}

fn is_public_v4(ip: Ipv4Addr) -> bool {
    let [a, b, c, _] = ip.octets();
    !(ip.is_unspecified()
        || ip.is_loopback()
        || ip.is_private()
        || ip.is_link_local()
        || ip.is_broadcast()
        || ip.is_multicast()
        || ip.is_documentation()
        // "This network".
        || a == 0
        // Shared address space for carrier-grade NAT.
        || (a == 100 && (64..128).contains(&b))
        // IETF protocol assignments.
        || (a == 192 && b == 0 && c == 0)
        // Benchmarking.
        || (a == 198 && (18..20).contains(&b))
        // Reserved for future use.
        || a >= 240)
}

fn is_public_v6(ip: Ipv6Addr) -> bool {
    // An IPv4 address written as IPv6 reaches that IPv4 address.
    if let Some(v4) = embedded_v4(ip) {
        return is_public_v4(v4);
    }
    let first = ip.segments()[0];
    !(ip.is_unspecified()
        || ip.is_loopback()
        || ip.is_multicast()
        // Unique local addresses.
        || (first & 0xfe00) == 0xfc00
        // Link-local unicast.
        || (first & 0xffc0) == 0xfe80
        // Site-local, deprecated but still in use on some networks.
        || (first & 0xffc0) == 0xfec0
        // Local-use IPv4/IPv6 translation (RFC 8215), which can reach private IPv4 addresses.
        || (first == 0x64 && ip.segments()[1] == 0xff9b && ip.segments()[2] == 1)
        // Documentation.
        || (first == 0x2001 && ip.segments()[1] == 0x0db8))
}

/// The IPv4 address an IPv6 address stands for: IPv4-mapped (`::ffff:a.b.c.d`), IPv4-compatible
/// (`::a.b.c.d`), the NAT64 prefix (`64:ff9b::a.b.c.d`), and 6to4 (`2002:aabb:ccdd::`).
fn embedded_v4(ip: Ipv6Addr) -> Option<Ipv4Addr> {
    let segments = ip.segments();
    let last_two = |s: &[u16; 8]| {
        let [_, _, _, _, _, _, high, low] = *s;
        Ipv4Addr::new((high >> 8) as u8, high as u8, (low >> 8) as u8, low as u8)
    };
    match segments {
        [0, 0, 0, 0, 0, 0xffff, _, _] => Some(last_two(&segments)),
        [0, 0, 0, 0, 0, 0, high, _] if high != 0 => Some(last_two(&segments)),
        [0x64, 0xff9b, 0, 0, 0, 0, _, _] => Some(last_two(&segments)),
        [0x2002, high, low, ..] => Some(Ipv4Addr::new(
            (high >> 8) as u8,
            high as u8,
            (low >> 8) as u8,
            low as u8,
        )),
        _ => None,
    }
}

/// The address `url` names when its host is an IP address rather than a name.
pub fn literal_ip(url: &Url) -> Option<IpAddr> {
    match url.host()? {
        url::Host::Ipv4(ip) => Some(IpAddr::V4(ip)),
        url::Host::Ipv6(ip) => Some(IpAddr::V6(ip)),
        url::Host::Domain(_) => None,
    }
}

/// Whether a page at `url` counts as on this machine or the local network: its address is written
/// as a private IP, or its host is `localhost` or a name under it, which browsers always resolve to
/// this machine. A page is judged by its address alone, never by looking its name up, which the
/// page's owner could point anywhere; a development server reached by another name counts as on
/// the internet.
pub fn is_local_page(url: &Url) -> bool {
    match url.host() {
        Some(url::Host::Domain(host)) => {
            let host = host.trim_end_matches('.');
            host.eq_ignore_ascii_case("localhost")
                || host.to_ascii_lowercase().ends_with(".localhost")
        }
        Some(_) => literal_ip(url).is_some_and(|ip| !is_public(ip)),
        None => false,
    }
}

/// The error for a request to an address a page may not reach.
pub fn not_public(host: &str) -> io::Error {
    io::Error::new(
        io::ErrorKind::PermissionDenied,
        format!("{host} is on a private network, which a page on the internet cannot reach"),
    )
}

/// Resolves host names to their public addresses only, so the connection itself is made to a
/// public address: checking the name first and connecting later would let a name that changes its
/// answer in between reach a private one.
pub struct PublicResolver;

impl Resolve for PublicResolver {
    fn resolve(&self, name: Name) -> Resolving {
        Box::pin(async move {
            let host = name.as_str().to_owned();
            let public: Vec<SocketAddr> = tokio::net::lookup_host((host.as_str(), 0))
                .await?
                .filter(|address| is_public(address.ip()))
                .collect();
            if public.is_empty() {
                return Err(not_public(&host).into());
            }
            let addresses: Addrs = Box::new(public.into_iter());
            Ok(addresses)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn public(text: &str) -> bool {
        is_public(text.parse().unwrap())
    }

    #[test]
    fn private_and_local_addresses_are_not_public() {
        for address in [
            "127.0.0.1",
            "127.1.2.3",
            "0.0.0.0",
            "10.0.0.1",
            "172.16.5.4",
            "192.168.1.1",
            "169.254.169.254",
            "100.64.0.1",
            "224.0.0.1",
            "255.255.255.255",
            "198.18.0.1",
            "240.0.0.1",
            "::1",
            "::",
            "fc00::1",
            "fd12:3456::1",
            "fe80::1",
            "ff02::1",
            "::ffff:127.0.0.1",
            "::ffff:192.168.0.1",
            "::127.0.0.1",
            "64:ff9b::a9fe:a9fe",
            "2002:c0a8:0101::1",
            "64:ff9b:1::c0a8:101",
            "fec0::1",
            "feff:ffff::1",
        ] {
            assert!(!public(address), "{address} counted as public");
        }
    }

    #[test]
    fn internet_addresses_are_public() {
        for address in [
            "1.1.1.1",
            "93.184.216.34",
            "172.32.0.1",
            "100.128.0.1",
            "2606:4700:4700::1111",
            "::ffff:8.8.8.8",
            "64:ff9b::808:808",
        ] {
            assert!(public(address), "{address} counted as private");
        }
    }

    #[test]
    fn literal_addresses_are_read_from_the_url() {
        let ip = |text: &str| literal_ip(&Url::parse(text).unwrap());
        assert_eq!(
            ip("http://127.0.0.1:8080/"),
            Some("127.0.0.1".parse().unwrap())
        );
        assert_eq!(ip("http://[::1]/"), Some("::1".parse().unwrap()));
        // The URL parser reads every spelling of an IPv4 address as one.
        assert_eq!(ip("http://2130706433/"), Some("127.0.0.1".parse().unwrap()));
        assert_eq!(ip("http://0x7f.1/"), Some("127.0.0.1".parse().unwrap()));
        assert_eq!(ip("https://example.com/"), None);
    }

    #[test]
    fn a_page_is_local_only_by_its_written_address() {
        let local = |text: &str| is_local_page(&Url::parse(text).unwrap());
        for page in [
            "http://localhost:3000/",
            "http://LOCALHOST./",
            "https://open-pencil.localhost/",
            "http://127.0.0.1:8080/",
            "http://192.168.1.10/",
            "http://[::1]/",
        ] {
            assert!(local(page), "{page}");
        }
        for page in [
            "https://example.com/",
            "https://localhost.example.com/",
            "https://notlocalhost/",
            "http://93.184.216.34/",
            "data:text/html,hi",
        ] {
            assert!(!local(page), "{page}");
        }
    }
}
