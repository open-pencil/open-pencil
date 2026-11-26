/// The longest line a program may send, past which what it wrote is dropped: a program that
/// never ends a line must not hold the app's memory.
pub const MAX_LINE_BYTES: usize = 256 * 1024 * 1024;

/// Bytes cut into the lines JSON-lines protocols send, each without its `\n`. A line split across
/// reads waits for its end.
#[derive(Default)]
pub struct Lines {
    partial: Vec<u8>,
    /// Whether the line being read ran past `MAX_LINE_BYTES`, so its rest is dropped too.
    overflowed: bool,
}

/// What a read gave: the whole lines, and whether a line too long was dropped.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Read {
    pub lines: Vec<String>,
    pub dropped: bool,
}

impl Lines {
    pub fn push(&mut self, bytes: &[u8]) -> Read {
        let mut read = Read::default();
        let mut start = 0;
        // Only the new bytes are searched, so a long line sent in small reads is scanned once.
        for (index, byte) in bytes.iter().enumerate() {
            if *byte != b'\n' {
                continue;
            }
            let piece = &bytes[start..index];
            if self.overflowed {
                self.overflowed = false;
            } else if self.partial.len() + piece.len() > MAX_LINE_BYTES {
                read.dropped = true;
            } else {
                self.partial.extend_from_slice(piece);
                read.lines
                    .push(String::from_utf8_lossy(&self.partial).into_owned());
            }
            self.partial.clear();
            start = index + 1;
        }
        let rest = &bytes[start..];
        if !self.overflowed {
            if self.partial.len() + rest.len() > MAX_LINE_BYTES {
                self.partial.clear();
                self.overflowed = true;
                read.dropped = true;
            } else {
                self.partial.extend_from_slice(rest);
            }
        }
        read
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_a_line_until_it_ends() {
        let mut lines = Lines::default();
        assert!(lines.push(b"{\"a\":").lines.is_empty());
        assert_eq!(
            lines.push(b"1}\n{\"b\":2}\n{\"c\"").lines,
            ["{\"a\":1}", "{\"b\":2}"]
        );
        assert_eq!(lines.push(b":3}\n").lines, ["{\"c\":3}"]);
        assert_eq!(lines.push("é\n".as_bytes()).lines, ["é"]);
    }

    #[test]
    fn drops_a_line_past_the_limit_and_reads_on() {
        let mut lines = Lines::default();
        let chunk = vec![b'x'; MAX_LINE_BYTES / 2 + 1];
        assert!(!lines.push(&chunk).dropped);
        assert!(lines.push(&chunk).dropped);
        // The rest of the long line is dropped, and the next line reads whole.
        let read = lines.push(b"tail\n{\"ok\":1}\n");
        assert_eq!(read.lines, ["{\"ok\":1}"]);
        assert!(!read.dropped);
    }
}
