#[macro_use]
extern crate serde_derive;

extern crate byteorder;
extern crate serde;
extern crate serde_json;

mod parse;
mod types;

use types::StreamType;

// Extract MemoryInfo from dump and return as JSON
pub fn memory_info_json(dump: &[u8]) -> Vec<u8> {
    let header = parse::parse_header(&dump)
        .map(|(h, _)| h)
        .expect("Failed to parse minidump::Header");

    let dir = parse::parse_directory(&dump, &header)
        .map(|(d, _)| d)
        .expect("Failed to parse minidump Directory list");

    let meminfostream = dir.iter()
        .find(|&el| el.StreamType == StreamType::MemoryInfoListStream as u32)
        .expect("Unable to find memory info stream");

    let meminfo = parse::parse_memory_info(&dump, &meminfostream.Location)
        .map(|(v, _)| v)
        .unwrap();

    serde_json::to_vec(&meminfo).expect("Serializing failed")
}

// Extract Module from dump and return as JSON
pub fn module_json(dump: &[u8]) -> Vec<u8> {
    let header = parse::parse_header(&dump)
        .map(|(h, _)| h)
        .expect("Failed to parse minidump::Header");

    let dir = parse::parse_directory(&dump, &header)
        .map(|(d, _)| d)
        .expect("Failed to parse minidump Directory list");

    let modulestream = dir.iter()
        .find(|&el| el.StreamType == StreamType::ModuleListStream as u32)
        .expect("Unable to find module list stream");

    let modules = parse::parse_module_list(&dump, &modulestream.Location)
        .map(|(v, _)| v)
        .unwrap();

    serde_json::to_vec(&modules).expect("Serializing failed")
}

// Extract Memory range info from dump and return as JSON
pub fn memory_range_json(dump: &[u8]) -> Vec<u8> {
    let header = parse::parse_header(&dump)
        .map(|(h, _)| h)
        .expect("Failed to parse minidump::Header");

    let dir = parse::parse_directory(&dump, &header)
        .map(|(d, _)| d)
        .expect("Failed to parse minidump Directory list");

    let memstream = dir.iter()
        .find(|&el| {
            el.StreamType == StreamType::MemoryListStream as u32
                || el.StreamType == StreamType::Memory64ListStream as u32
        })
        .expect("Unable to find memory stream");

    let parse_fn = if memstream.StreamType == StreamType::Memory64ListStream as u32 {
        parse::parse_memory64_list
    } else {
        parse::parse_memory_list
    };

    let ranges = parse_fn(&dump, &memstream.Location)
        .map(|(v, _)| v)
        .unwrap();

    serde_json::to_vec(&ranges).expect("Serializing failed")
}
