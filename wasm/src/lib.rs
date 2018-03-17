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

// Extract MemoryInfo data from a minidump
#[no_mangle]
pub unsafe fn minidump_memory_info(raw: *mut WasmBuffer) -> *mut WasmBuffer {
    let json = minidump::memory_info_json(&*raw);
    let boxed = Box::new(json);
    Box::into_raw(boxed)
}

// Extract Module data from a minidump
#[no_mangle]
pub unsafe fn minidump_module(raw: *mut WasmBuffer) -> *mut WasmBuffer {
    let json = minidump::module_json(&*raw);
    let boxed = Box::new(json);
    Box::into_raw(boxed)
}

// Extract Memory Range data from a minidump
#[no_mangle]
pub unsafe fn minidump_memory_range(raw: *mut WasmBuffer) -> *mut WasmBuffer {
    let json = minidump::memory_range_json(&*raw);
    let boxed = Box::new(json);
    Box::into_raw(boxed)
}
