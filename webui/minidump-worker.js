class MinidumpProcessor {
    constructor(responder) {
        this.responder = responder;
    }

    process(data) {
        let view = new DataView(data);

        // Get 4-byte header magic
        let magic = "";
        for (let i = 0; i < 4; i++)
            magic += String.fromCharCode(view.getUint8(i));

        this.responder.postMessage({
            'topic': 'result',
            'magic': magic,
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
