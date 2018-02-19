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

    writeArrayToMemory(src, ptr) {
        let dst = new Uint8Array(wasm.exports.memory.buffer);
        dst.set(src, ptr);
    }

    UTF8ToString(ptr) {
        let src = new Uint8Array(wasm.exports.memory.buffer, ptr);
        let null_index = src.indexOf(0x00);
        let dec = new TextDecoder('utf-8');
        return dec.decode(src.subarray(0, null_index));
    }

    get_magic(data) {
        let view = new DataView(data);

        // Get 4-byte header magic
        let magic = "";
        for (let i = 0; i < 4; i++)
            magic += String.fromCharCode(view.getUint8(i));

        return magic;
    }

    wasm_memory_info(data) {
        // Copy data into WASM
        let view = new Uint8Array(data);
        let wasm_data = wasm.exports.alloc_buffer(data.byteLength);
        this.writeArrayToMemory(view, wasm_data);

        // Run WASM
        let raw = wasm.exports.minidump_memory_info(wasm_data, data.byteLength);

        // Release WASM buffer
        wasm.exports.free_buffer(wasm_data, data.byteLength);
        wasm_data = null;

        // Extract JSON result
        let json = this.UTF8ToString(raw);

        // Release buffer
        wasm.exports.release_json(raw);
        raw = null;

        return json;
    }

    wasm_module_info(data) {
        // Copy data into WASM
        let view = new Uint8Array(data);
        let wasm_data = wasm.exports.alloc_buffer(data.byteLength);
        this.writeArrayToMemory(view, wasm_data);

        // Run WASM
        let raw = wasm.exports.minidump_module(wasm_data, data.byteLength);

        // Release WASM buffer
        wasm.exports.free_buffer(wasm_data, data.byteLength);
        wasm_data = null;

        // Extract JSON result
        let json = this.UTF8ToString(raw);

        // Release buffer
        wasm.exports.release_json(raw);
        raw = null;

        return json;
    }

    process(data) {
        let magic = this.get_magic(data);
        let module_info = this.wasm_module_info(data);
        let memory_info = this.wasm_memory_info(data);

        // Send response to caller
        this.responder.postMessage({
            'topic': 'result',
            'magic': magic,
            'module_info': module_info,
            'memory_info': memory_info,
            'bytelen': data.byteLength,
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
