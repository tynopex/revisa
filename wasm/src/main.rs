#[macro_use]
extern crate serde_derive;

extern crate serde;
extern crate serde_json;

mod minidump;

use std::os::raw::c_char;
use std::ffi::CString;


// Boilerplate for WASM compiler
fn main() { }

// Example API for Javascript
#[no_mangle]
pub unsafe fn sum_bytes(raw: *const u8, size: u32) -> u8 {
    let data = std::slice::from_raw_parts(raw, size as usize);
    sum_bytes_impl(data)
}

fn sum_bytes_impl(data: &[u8]) -> u8 {
    data.iter().sum()
}


// Use this to release JSON results from API calls
#[no_mangle]
pub unsafe fn release_json(raw: *mut c_char) {
    drop(CString::from_raw(raw));
}


// Extract MemoryInfo data from a minidump
#[no_mangle]
pub unsafe fn minidump_memory_info(raw: *const u8, size: u32) -> *mut c_char {
    let data = std::slice::from_raw_parts(raw, size as usize);
    let cstr = minidump::memory_info_json(data);
    cstr.into_raw()
}

// Extract Module data from a minidump
#[no_mangle]
pub unsafe fn minidump_module(raw: *const u8, size: u32) -> *mut c_char {
    let data = std::slice::from_raw_parts(raw, size as usize);
    let cstr = minidump::module_json(data);
    cstr.into_raw()
}
