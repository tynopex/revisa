self.importScripts('revisa-wasm.js');

// Load WASM module
let wasm = RevisaWasm();

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

    wasm_memory_info(data) {
        // Copy data into WASM
        let view = new Uint8Array(data);
        let wasm_data = wasm._malloc(data.byteLength);
        wasm.writeArrayToMemory(view, wasm_data);

        // Run WASM
        let raw = wasm.ccall('minidump_memory_info',        // Function Name
                             'number',                      // Return Type
                             ['number', 'number'],          // Argument Types
                             [wasm_data, data.byteLength]); // Arguments

        // Release WASM buffer
        wasm._free(wasm_data);
        wasm_data = null;

        // Extract JSON result
        let json = wasm.UTF8ToString(raw);

        // Release buffer
        wasm.ccall('release_json',  // Function Name
                   null,            // Return Type
                   ['number'],      // Argument Types
                   [raw]);          // Arguments
        raw = null;

        return json;
    }

    wasm_module_info(data) {
        // Copy data into WASM
        let view = new Uint8Array(data);
        let wasm_data = wasm._malloc(data.byteLength);
        wasm.writeArrayToMemory(view, wasm_data);

        // Run WASM
        let raw = wasm.ccall('minidump_module',             // Function Name
                             'number',                      // Return Type
                             ['number', 'number'],          // Argument Types
                             [wasm_data, data.byteLength]); // Arguments

        // Release WASM buffer
        wasm._free(wasm_data);
        wasm_data = null;

        // Extract JSON result
        let json = wasm.UTF8ToString(raw);

        // Release buffer
        wasm.ccall('release_json',  // Function Name
                   null,            // Return Type
                   ['number'],      // Argument Types
                   [raw]);          // Arguments
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
