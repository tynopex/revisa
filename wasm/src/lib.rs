extern crate revisa_minidump;

use revisa_minidump as minidump;

// Use opaque buffer type for interop
type WasmBuffer = Vec<u8>;

#[no_mangle]
pub unsafe fn buffer_alloc(size: usize) -> *mut WasmBuffer {
    let vec = vec![0u8; size];
    let boxed = Box::new(vec);
    Box::into_raw(boxed)
}

#[no_mangle]
pub unsafe fn buffer_ptr(raw: *mut WasmBuffer) -> *mut u8 {
    (*raw).as_mut_ptr()
}

#[no_mangle]
pub unsafe fn buffer_len(raw: *mut WasmBuffer) -> usize {
    (*raw).len()
}

#[no_mangle]
pub unsafe fn buffer_free(raw: *mut WasmBuffer) {
    drop(Box::from_raw(raw));
}

// Find available minidump overlay data
#[no_mangle]
pub unsafe fn minidump_memory_overlay(raw: *mut WasmBuffer) -> *mut WasmBuffer {
    let json = minidump::memory_overlay_json(&*raw);
    let boxed = Box::new(json);
    Box::into_raw(boxed)
}

// Analyze memory data in a minidump
#[no_mangle]
pub unsafe fn minidump_memory_analysis(raw: *mut WasmBuffer) -> *mut WasmBuffer {
    let json = minidump::memory_analysis_json(&*raw);
    let boxed = Box::new(json);
    Box::into_raw(boxed)
}

// Find thread list in a minidump
#[no_mangle]
pub unsafe fn minidump_thread_list(raw: *mut WasmBuffer) -> *mut WasmBuffer {
    let json = minidump::thread_list_json(&*raw);
    let boxed = Box::new(json);
    Box::into_raw(boxed)
}

// Find exception record in a minidump
#[no_mangle]
pub unsafe fn minidump_exception_record(raw: *mut WasmBuffer) -> *mut WasmBuffer {
    let json = minidump::exception_record_json(&*raw);
    let boxed = Box::new(json);
    Box::into_raw(boxed)
}

// Find system info record in a minidump
#[no_mangle]
pub unsafe fn minidump_system_info(raw: *mut WasmBuffer) -> *mut WasmBuffer {
    let json = minidump::system_info_json(&*raw);
    let boxed = Box::new(json);
    Box::into_raw(boxed)
}
