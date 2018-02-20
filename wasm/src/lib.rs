extern crate memalloc;
extern crate revisa_minidump;

use std::os::raw::c_char;
use std::ffi::CString;

use revisa_minidump as minidump;


// Memory allocation helpers
#[no_mangle]
pub unsafe fn alloc_buffer(size: u32) -> *mut u8 {
    if size > 0 {
        memalloc::allocate(size as usize)
    } else {
        std::ptr::null_mut()
    }
}

#[no_mangle]
pub unsafe fn free_buffer(ptr: *mut u8, size: u32) {
    if size > 0 {
        memalloc::deallocate(ptr, size as usize)
    }
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
