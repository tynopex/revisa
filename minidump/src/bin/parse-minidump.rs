extern crate revisa_minidump;

use std::io::prelude::*;
use std::fs::File;

fn main() {
    let mut buf: Vec<u8> = Vec::new();

    if let Some(fname) = std::env::args().skip(1).next() {
        let mut f = File::open(fname).expect("file not found");
        f.read_to_end(&mut buf).expect("failed to read");
    } else {
        println!("Need to specify minidump file to read!");
        std::process::exit(1);
    }

    {
        let x = revisa_minidump::memory_info_json(&buf);
        let _json = String::from_utf8(x).expect("bad UTF-8");
    }

    {
        let x = revisa_minidump::memory_range_json(&buf);
        let _json = String::from_utf8(x).expect("bad UTF-8");
    }

    println!("Parse Complete");
}