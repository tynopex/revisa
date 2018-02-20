// Load WASM module
let wasm = null;
fetch('revisa_wasm.wasm')
    .then(response => response.arrayBuffer())
    .then(bytes => WebAssembly.instantiate(bytes))
    .then(({instance}) => wasm = instance);

class MinidumpProcessor {
    constructor(responder) {
        this.responder = responder;
    }

    get_magic(data) {
        let view = new DataView(data);

        // Get 4-byte header magic
        let magic = "";
        for (let i = 0; i < 4; i++)
            magic += String.fromCharCode(view.getUint8(i));

        return magic;
    }

    // Allocate bytes in WASM
    wasm_alloc(nbyte) {
        let ptr = wasm.exports.alloc_buffer(nbyte);
        return { ptr: ptr, len: nbyte };
    }

    // Free a previous WASM allocation
    wasm_free(wasm_buf) {
        wasm.exports.free_buffer(wasm_buf.ptr, wasm_buf.len);
        delete wasm_buf.len;
        delete wasm_buf.ptr;
    }

    // Allocates memory in WASM and copies from an ArrayBuffer
    data_to_wasm(arrayBuffer) {
        let wasm_buf = this.wasm_alloc(arrayBuffer.byteLength);
        let wasm_mem = wasm.exports.memory.buffer;

        let src = new Uint8Array(arrayBuffer);
        let dst = new Uint8Array(wasm_mem, wasm_buf.ptr);
        dst.set(src);

        return wasm_buf;
    }

    // Transfer a JSON string from WASM into JS and free WASM memory
    wasm_to_json(wasm_ptr) {
        let wasm_mem = wasm.exports.memory.buffer;

        // Find span of null-terminated string (excluding null)
        let src = new Uint8Array(wasm_mem, wasm_ptr);
        let len = src.indexOf(0x00);
        src = src.subarray(0, len);

        // Decode string data
        let decoder = new TextDecoder('utf-8');
        let json = decoder.decode(src);

        // Release WASM buffer
        wasm.exports.release_json(wasm_ptr);

        return json;
    }

    wasm_memory_info(wasm_buf) {
        let raw = wasm.exports.minidump_memory_info(wasm_buf.ptr, wasm_buf.len);
        return this.wasm_to_json(raw);
    }

    wasm_module_info(wasm_buf) {
        let raw = wasm.exports.minidump_module(wasm_buf.ptr, wasm_buf.len);
        return this.wasm_to_json(raw);
    }

    process(data) {
        // Copy minidump to WASM memory
        let wasm_data = this.data_to_wasm(data);

        let magic = this.get_magic(data);
        let module_info = this.wasm_module_info(wasm_data);
        let memory_info = this.wasm_memory_info(wasm_data);

        // Release WASM memory
        this.wasm_free(wasm_data);

        // Send response to caller
        this.responder.postMessage({
            'topic': 'result',
            'magic': magic,
            'bytelen': data.byteLength,
            'module_info': module_info,
            'memory_info': memory_info,
        });
    }
}

// Message handler
self.onmessage = function(e) {
    if (e.data.topic == 'file') {
        let processor = new MinidumpProcessor(self);
        processor.process(e.data.data);
    }
}
