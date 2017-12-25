self.importScripts('revisa-wasm.js');

// Load WASM module
let wasm = RevisaWasm();

class MinidumpProcessor {
    constructor(responder) {
        this.responder = responder;
    }

    wasm_sum_bytes(data) {
        // Copy data into WASM
        let view = new Uint8Array(data);
        let wasm_data = wasm._malloc(data.byteLength);
        wasm.writeArrayToMemory(view, wasm_data);

        // Run WASM
        let sum = wasm.ccall('sum_bytes',                     // Function Name
                             'number',                        // Return Type
                             ['number', 'number'],            // Argument Types
                             [wasm_data, data.byteLength]);   // Arguments

        // Release WASM buffer
        wasm._free(wasm_data);
        wasm_data = null;

        return sum;
    }

    sum_bytes(data) {
        let view = new DataView(data);

        let sum = 0;
        for (let i = 0; i < data.byteLength; i++)
            sum = (sum + view.getUint8(i)) & 0xFF;

        return sum;
    }

    get_magic(data) {
        let view = new DataView(data);

        // Get 4-byte header magic
        let magic = "";
        for (let i = 0; i < 4; i++)
            magic += String.fromCharCode(view.getUint8(i));

        return magic;
    }

    process(data) {
        let magic = this.get_magic(data);
        let sum = this.sum_bytes(data);
        let wasm_sum = this.wasm_sum_bytes(data);

        // Send response to caller
        this.responder.postMessage({
            'topic': 'result',
            'magic': magic,
            'sum': sum,
            'wasm_sum': wasm_sum,
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
