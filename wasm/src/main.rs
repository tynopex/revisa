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
