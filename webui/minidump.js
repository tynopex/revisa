class MinidumpViewer {
    constructor(control) {
        this.control = control;

        let self = this;
        this.worker = new Worker('minidump-worker.js');
        this.worker.onmessage = function(e) { self.onmessage(e); }
    }

    bind(elem) {
        this.dom = elem;
        this.dom.innerHTML = "";
        this.dom.className = 'minidump';

        let self = this;
        let form = document.createElement('form');
        let input = document.createElement('input');
        input.type = 'file';
        input.id = 'input';
        input.onchange = function() {
            self.load_minidump(this.files);
        }
        form.appendChild(input);
        this.dom.appendChild(form);

        this.body = document.createElement('div');
        this.dom.appendChild(this.body);
    }

    load_minidump(files) {
        let self = this;
        let file = files[0];
        let reader = new FileReader();
        reader.onload = function(e) {
            let data = this.result;
            self.worker.postMessage({
                'topic': 'file',
                'data': data,
                }, [data]);
        }
        reader.readAsArrayBuffer(file);
    }

    render_memory(mem_info, mod_info, dom) {
        // State Flags
        const MEM_COMMIT    = 0x00001000;
        const MEM_RESERVE   = 0x00002000;
        const MEM_FREE      = 0x00010000;

        // Type Flags
        const MEM_PRIVATE   = 0x00020000;
        const MEM_MAPPED    = 0x00040000;
        const MEM_IMAGE     = 0x01000000;

        // Find filenames of mapped modules
        let mem_names = {};
        for (let item of mod_info) {
            mem_names[item.BaseOfImage] = item.ModuleName;
        }

        let list = document.createElement('ul');
        for (let item of mem_info) {
            let elem = document.createElement('li');
            elem.append(item.BaseAddress.toString(16).padStart(12, '0'));

            // Memory state sets CSS class
            if (item.State == MEM_COMMIT) {
                elem.className = "commit";
            } else if (item.State == MEM_FREE) {
                elem.className = "free";
            } else if (item.State == MEM_RESERVE) {
                elem.className = "reserve";
            } else {
                elem.className = "unknown";
            }

            // Mark regions that are part of image
            if (item.Type & MEM_IMAGE) {
                elem.className += " image";

                // Add image filename
                if (item.BaseAddress in mem_names) {
                    elem.append('\u00A0');
                    elem.append(mem_names[item.BaseAddress]);
                }
            }

            list.appendChild(elem);
        }
        dom.appendChild(list);
    }

    show_result(result) {
        this.body.innerHTML = "";
        this.body.append("Header Signature: " + result.magic);
        this.body.append(document.createElement('br'));
        this.body.append("Byte Sum (WASM): " + result.wasm_sum);
        this.body.append(document.createElement('br'));
        this.body.append("Byte Sum: " + result.sum);
        this.body.append(document.createElement('br'));
        this.body.append("Data Size: " + result.bytelen);

        let mem_dom = document.createElement('div');
        mem_dom.className = "meminfo";
        let mod_info = JSON.parse(result.module_info);
        let mem_info = JSON.parse(result.memory_info);
        this.render_memory(mem_info, mod_info, mem_dom);
        this.body.append(mem_dom);
    }

    onmessage(e) {
        if (e.data.topic == 'result') {
            this.show_result(e.data);
        }
    }
}
