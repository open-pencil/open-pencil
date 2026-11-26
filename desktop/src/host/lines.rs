/// Bytes cut into the lines JSON-lines protocols send, each without its `\n`. A line split across
/// reads waits for its end.
#[derive(Default)]
pub struct Lines {
    partial: Vec<u8>,
}

impl Lines {
    pub fn push(&mut self, bytes: &[u8]) -> Vec<String> {
        self.partial.extend_from_slice(bytes);
        let Some(end) = self.partial.iter().rposition(|byte| *byte == b'\n') else {
            return Vec::new();
        };
        let rest = self.partial.split_off(end + 1);
        let complete = std::mem::replace(&mut self.partial, rest);
        complete[..end]
            .split(|byte| *byte == b'\n')
            .map(|line| String::from_utf8_lossy(line).into_owned())
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_a_line_until_it_ends() {
        let mut lines = Lines::default();
        assert!(lines.push(b"{\"a\":").is_empty());
        assert_eq!(lines.push(b"1}\n{\"b\":2}\n{\"c\""), ["{\"a\":1}", "{\"b\":2}"]);
        assert_eq!(lines.push(b":3}\n"), ["{\"c\":3}"]);
        assert_eq!(lines.push("é\n".as_bytes()), ["é"]);
    }
}
