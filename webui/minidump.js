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

        function FormatProtect(pr) {
            let base = pr & 0xFF;
            let res = "" + base;

            if      (base == 0x00) res = "";
            else if (base == 0x01) res = "NA";
            else if (base == 0x02) res = "RO";
            else if (base == 0x04) res = "RW";
            else if (base == 0x08) res = "WC";
            else if (base == 0x10) res = "EX";
            else if (base == 0x20) res = "EX+RD";
            else if (base == 0x40) res = "EX+RW";
            else if (base == 0x80) res = "EX+WC";

            if (pr & 0x100) res += "+PG";
            if (pr & 0x200) res += "+NC";
            if (pr & 0x400) res += "+WC";

            let other = pr & ~0x7FF;
            if (other)
                res += "+" + other;

            return res;
        }

        function FormatSize(sz) {
            if (sz & 0xFFF)
                return "BAD_SIZE[" + sz + "]";

            let kb = sz / 1024;
            if (kb < 10000)
                return kb.toFixed() + "kB";

            let mb = kb / 1024;
            if (mb < 10000)
                return mb.toFixed() + "MB";

            let gb = mb / 1024;
            if (gb < 10000)
                return gb.toFixed() + "GB";

            let tb = gb / 1024;
            if (tb < 10000)
                return tb.toFixed() + "TB";

            let eb = tb / 1024;
            if (eb < 10000)
                return eb.toFixed() + "EB";
        }

        let list = document.createElement('ul');
        let lastAllocationBase = 0;
        let allocStripe = false;
        for (let item of mem_info) {
            let elem = document.createElement('li');

            // Track runs of entries with same AllocationBase
            if (lastAllocationBase != item.AllocationBase)
                allocStripe = !allocStripe;
            lastAllocationBase = item.AllocationBase;
            let stripeSpan = document.createElement('span');
            stripeSpan.append('\u00A0\u00A0');
            stripeSpan.title = item.AllocationBase.toString(16).padStart(12, '0');
            if (allocStripe)
                stripeSpan.className = "alt";
            elem.append(stripeSpan);

            elem.append(item.BaseAddress.toString(16).padStart(12, '0'));
            elem.append(" " + FormatSize(item.RegionSize).padStart(6, '\u00A0'));
            elem.append(" " + FormatProtect(item.Protect));

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

    render_memory_range(mem_range, dom) {
        let list = document.createElement('ul');

        let ranges = Array.from(mem_range);
        ranges.sort((l,r) => (l.StartOfMemoryRange - r.StartOfMemoryRange));

        for (let item of ranges) {
            let elem = document.createElement('li');
            elem.append('\u00A0\u00A0');
            elem.append(item.StartOfMemoryRange.toString(16).padStart(12, '0'));
            elem.append(" " + item.DataSize.toString().padStart(6, '\u00A0'));

            list.appendChild(elem);
        }
        dom.appendChild(list);
    }

    show_result(result) {
        this.body.innerHTML = "";
        this.body.append("Header Signature: " + result.magic);
        this.body.append(document.createElement('br'));
        this.body.append("Data Size: " + result.bytelen);

        let mem_dom = document.createElement('div');
        mem_dom.className = "meminfo";
        let mod_info = JSON.parse(result.module_info);
        let mem_info = JSON.parse(result.memory_info);
        this.render_memory(mem_info, mod_info, mem_dom);
        this.body.append(mem_dom);

        let memdata_dom = document.createElement('div');
        memdata_dom.className = "memdata";
        let mem_range = JSON.parse(result.memory_range);
        this.render_memory_range(mem_range, memdata_dom);
        this.body.append(memdata_dom);
    }

    onmessage(e) {
        if (e.data.topic == 'result') {
            this.show_result(e.data);
        }
    }
}
