class MemoryFlags {
    static FormatProtect(pr) {
        let base = pr & 0xFF;
        let res = "" + base;

        if      (base == 0x00) res = "";
        else if (base == 0x01) res = "NA";
        else if (base == 0x02) res = "RO";
        else if (base == 0x04) res = "RW";
        else if (base == 0x08) res = "CW";
        else if (base == 0x10) res = "EX";
        else if (base == 0x20) res = "EX+RD";
        else if (base == 0x40) res = "EX+RW";
        else if (base == 0x80) res = "EX+CW";

        if (pr & 0x100) res += "+PG";
        if (pr & 0x200) res += "+NC";
        if (pr & 0x400) res += "+WC";

        let other = pr & ~0x7FF;
        if (other)
            res += "+" + other;

        return res;
    }

    static FormatSize(sz) {
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
}
// State Flags
MemoryFlags.MEM_COMMIT   = 0x00001000;
MemoryFlags.MEM_RESERVE  = 0x00002000;
MemoryFlags.MEM_FREE     = 0x00010000;
// Type Flags
MemoryFlags.MEM_PRIVATE  = 0x00020000;
MemoryFlags.MEM_MAPPED   = 0x00040000;
MemoryFlags.MEM_IMAGE    = 0x01000000;

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

    render_memory(mem_info, dom) {
        let allocStripe = false;
        let prev_limit = 0;

        // Threshold for unallocated regions to be rendered compact
        const SMALL_UNALLOCATED = 1024 * 1024;

        for (let alloc of mem_info) {
            // Add div if there is free address space between allocations.
            if (alloc.AllocationBase > prev_limit) {
                let base = prev_limit;
                let size = alloc.AllocationBase - prev_limit;

                let empty_elem = document.createElement('div');
                empty_elem.className = "free";

                let detail = document.createElement('span');
                detail.append(base.toString(16).padStart(12, '0'));
                detail.append(" " + MemoryFlags.FormatSize(size).padStart(6, '\u00A0'));
                empty_elem.appendChild(detail);

                // Hide details of small regions
                if (size < SMALL_UNALLOCATED)
                    empty_elem.classList.add("collapse");

                // Click on div to toggle collapse
                empty_elem.addEventListener("click", ev => {
                    ev.currentTarget.classList.toggle("collapse");
                });

                dom.appendChild(empty_elem);
            }
            prev_limit = alloc.AllocationBase + alloc.AllocationSize;

            // Alternate stripe per allocation region
            allocStripe = !allocStripe;

            let alloc_elem = document.createElement('div');
            alloc_elem.className = "alloc";
            if (allocStripe)
                alloc_elem.classList.add("alt");

            // Collapsed form
            let folded_elem = document.createElement('div');
            folded_elem.className = "folded";
            folded_elem.append(alloc.AllocationBase.toString(16).padStart(12, '0'));
            folded_elem.append(" " + MemoryFlags.FormatSize(alloc.AllocationSize).padStart(6, '\u00A0'));
            if (alloc.ModuleName)
                folded_elem.append('\u00A0' + alloc.ModuleName);
            alloc_elem.appendChild(folded_elem);

            // Click on div to toggle collapse
            alloc_elem.addEventListener("click", ev => {
                ev.currentTarget.classList.toggle("collapse");
            });

            for (let item of alloc.Regions) {
                let elem = document.createElement('div');

                elem.append(item.BaseAddress.toString(16).padStart(12, '0'));
                elem.append(" " + MemoryFlags.FormatSize(item.RegionSize).padStart(6, '\u00A0'));
                elem.append(" " + MemoryFlags.FormatProtect(item.Protect).padEnd(8, '\u00A0'));

                // Memory state sets CSS class
                if (item.State == MemoryFlags.MEM_COMMIT) {
                    elem.className = "commit";
                } else if (item.State == MemoryFlags.MEM_FREE) {
                    elem.className = "free";
                } else if (item.State == MemoryFlags.MEM_RESERVE) {
                    elem.className = "reserve";
                } else {
                    elem.className = "unknown";
                }

                // Mark regions that are part of image
                if (item.Type & MemoryFlags.MEM_IMAGE) {
                    elem.className += " image";

                    // Add image filename
                    if (item.BaseAddress == alloc.AllocationBase) {
                        if (alloc.ModuleName)
                            elem.append('\u00A0' + alloc.ModuleName);
                    }
                }

                alloc_elem.appendChild(elem);
            }

            dom.appendChild(alloc_elem);
        }
    }

    render_memory_range(mem_range, dom) {
        let list = document.createElement('ul');

        let ranges = Array.from(mem_range);
        ranges.sort((l,r) => (l.Address - r.Address));

        for (let item of ranges) {
            let elem = document.createElement('li');
            elem.append('\u00A0\u00A0');
            elem.append(item.Address.toString(16).padStart(12, '0'));
            elem.append(" " + item.Location.Length.toString().padStart(6, '\u00A0'));

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
        let mem_info = JSON.parse(result.memory_info);
        this.render_memory(mem_info, mem_dom);
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
