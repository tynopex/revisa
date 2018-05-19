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

    wasm_memory_overlay(wasm_buf) {
        let res = wasm.exports.minidump_memory_overlay(wasm_buf);
        return this.wasm_to_json(res);
    }

    wasm_memory_analysis(wasm_buf) {
        let res = wasm.exports.minidump_memory_analysis(wasm_buf);
        return this.wasm_to_json(res);
    }

    wasm_thread_list(wasm_buf) {
        let res = wasm.exports.minidump_thread_list(wasm_buf);
        return this.wasm_to_json(res);
    }

    wasm_exception_record(wasm_buf) {
        let res = wasm.exports.minidump_exception_record(wasm_buf);
        return this.wasm_to_json(res);
    }

    wasm_system_info(wasm_buf) {
        let res = wasm.exports.minidump_system_info(wasm_buf);
        return this.wasm_to_json(res);
    }

    process(data) {
        // Copy minidump to WASM memory
        let wasm_buf = this.data_to_wasm(data);

        // Run analysis
        let result = {
            'topic': 'result',
            'magic': this.get_magic(data),
            'bytelen': data.byteLength,
            'memory_info': this.wasm_memory_analysis(wasm_buf),
            'memory_range': this.wasm_memory_overlay(wasm_buf),
            'thread_list': this.wasm_thread_list(wasm_buf),
            'exception_record': this.wasm_exception_record(wasm_buf),
            'system_info': this.wasm_system_info(wasm_buf),
        };

        // Release WASM memory
        wasm.exports.buffer_free(wasm_buf);

        // Send response to caller
        this.responder.postMessage(result);
    }
}

// Message handler
self.onmessage = function(e) {
    if (e.data.topic == 'file') {
        let processor = new MinidumpProcessor(self);
        processor.process(e.data.data);
    }
}
