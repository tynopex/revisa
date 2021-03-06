#[macro_use]
extern crate serde_derive;

extern crate byteorder;
extern crate serde;
extern crate serde_json;

mod mem_analysis;
mod parse;
mod types;

use types::StreamType;

// Find available overlay data ranges and return as JSON
pub fn memory_overlay_json(dump: &[u8]) -> Vec<u8> {
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

// Analyze memory info into a more useful format
pub fn memory_analysis_json(dump: &[u8]) -> Vec<u8> {
    let analysis = mem_analysis::memory_analysis(dump);

    serde_json::to_vec(&analysis).expect("Serializing failed")
}

// Find list of threads and return as JSON
pub fn thread_list_json(dump: &[u8]) -> Vec<u8> {
    let header = parse::parse_header(&dump)
        .map(|(h, _)| h)
        .expect("Failed to parse minidump::Header");

    let dir = parse::parse_directory(&dump, &header)
        .map(|(d, _)| d)
        .expect("Failed to parse minidump Directory list");

    let threadlist = dir.iter()
        .find(|&el| el.StreamType == StreamType::ThreadListStream as u32)
        .expect("Unable to find thread list");

    let threads = parse::parse_thread_list(dump, &threadlist.Location)
        .map(|(v, _)| v)
        .unwrap();

    serde_json::to_vec(&threads).expect("Serializing failed")
}

// Find exception record and return as JSON
pub fn exception_record_json(dump: &[u8]) -> Vec<u8> {
    let header = parse::parse_header(&dump)
        .map(|(h, _)| h)
        .expect("Failed to parse minidump::Header");

    let dir = parse::parse_directory(&dump, &header)
        .map(|(d, _)| d)
        .expect("Failed to parse minidump Directory list");

    let stream = dir.iter()
        .find(|&el| el.StreamType == StreamType::ExceptionStream as u32)
        .expect("Unable to find exception record");

    let record = parse::parse_exception_stream(dump, &stream.Location)
        .map(|(v, _)| v)
        .unwrap();

    serde_json::to_vec(&record).expect("Serializing failed")
}

// Find system info and return as JSON
pub fn system_info_json(dump: &[u8]) -> Vec<u8> {
    let header = parse::parse_header(&dump)
        .map(|(h, _)| h)
        .expect("Failed to parse minidump::Header");

    let dir = parse::parse_directory(&dump, &header)
        .map(|(d, _)| d)
        .expect("Failed to parse minidump Directory list");

    let stream = dir.iter()
        .find(|&el| el.StreamType == StreamType::SystemInfoStream as u32)
        .expect("Unable to find system info");

    let system_info = parse::parse_system_info(dump, &stream.Location)
        .map(|(v, _)| v)
        .unwrap();

    serde_json::to_vec(&system_info).expect("Serializing failed")
}
