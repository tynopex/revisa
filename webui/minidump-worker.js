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

    // Allocates memory in WASM and copies from an ArrayBuffer
    data_to_wasm(arrayBuffer) {
        let wasm_buf = wasm.exports.buffer_alloc(arrayBuffer.byteLength);
        let wasm_ptr = wasm.exports.buffer_ptr(wasm_buf);
        let wasm_len = wasm.exports.buffer_len(wasm_buf);

        let wasm_mem = wasm.exports.memory.buffer;
        let src = new Uint8Array(arrayBuffer);
        let dst = new Uint8Array(wasm_mem, wasm_ptr);
        dst.set(src);

        return wasm_buf;
    }

    // Transfer a JSON string from WASM into JS and free WASM memory
    wasm_to_json(wasm_buf) {
        let wasm_ptr = wasm.exports.buffer_ptr(wasm_buf);
        let wasm_len = wasm.exports.buffer_len(wasm_buf);

        let wasm_mem = wasm.exports.memory.buffer;
        let src = new Uint8Array(wasm_mem, wasm_ptr, wasm_len);

        // Decode string data
        let decoder = new TextDecoder('utf-8');
        let json = decoder.decode(src);

        // Release WASM buffer
        wasm.exports.buffer_free(wasm_buf);

        return json;
    }

    wasm_memory_info(wasm_buf) {
        let res = wasm.exports.minidump_memory_info(wasm_buf);
        return this.wasm_to_json(res);
    }

    wasm_module_info(wasm_buf) {
        let res = wasm.exports.minidump_module(wasm_buf);
        return this.wasm_to_json(res);
    }

    wasm_memory_range(wasm_buf) {
        let res = wasm.exports.minidump_memory_range(wasm_buf);
        return this.wasm_to_json(res);
    }

    process(data) {
        // Copy minidump to WASM memory
        let wasm_data = this.data_to_wasm(data);

        // Run analysis
        let magic = this.get_magic(data);
        let module_info = this.wasm_module_info(wasm_data);
        let memory_info = this.wasm_memory_info(wasm_data);
        let memory_range = this.wasm_memory_range(wasm_data);

        // Release WASM memory
        wasm.exports.buffer_ptr(wasm_data);

        // Send response to caller
        this.responder.postMessage({
            'topic': 'result',
            'magic': magic,
            'bytelen': data.byteLength,
            'module_info': module_info,
            'memory_info': memory_info,
            'memory_range': memory_range,
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
