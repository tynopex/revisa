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

    render_allocation_range(alloc, dom) {
        let elem = document.createElement('span');
        elem.className = "range";
        elem.append(alloc.AllocationBase.toString(16)
                                        .padStart(12, '0'));
        elem.append(" ");
        elem.append(MemoryFlags.FormatSize(alloc.AllocationSize)
                               .padStart(6, '\u00A0'));
        dom.appendChild(elem);
    }

    make_collapsable(elem, default_collapse = false) {
        if (default_collapse)
            elem.classList.add("collapse");

        elem.addEventListener("click", ev => {
            ev.currentTarget.classList.toggle("collapse");
        });
    }

    render_memory(mem_info, dom) {
        let prev_limit = 0;

        for (let alloc of mem_info) {
            // Detect free space between allocations
            if (alloc.AllocationBase > prev_limit) {
                let fake_alloc = {
                    AllocationBase: prev_limit,
                    AllocationSize: alloc.AllocationBase - prev_limit,
                };

                // Default-collapse entries under 1MB
                let default_collapse = (fake_alloc.AllocationSize < 1024*1024);

                // <div> for the allocation region
                let alloc_elem = document.createElement('div');
                alloc_elem.className = "free";
                this.make_collapsable(alloc_elem, default_collapse);

                // <div> for the protection region
                let elem = document.createElement('div');
                elem.className = "free";
                this.render_allocation_range(fake_alloc, elem);

                alloc_elem.appendChild(elem);
                dom.appendChild(alloc_elem);
            }
            prev_limit = alloc.AllocationBase + alloc.AllocationSize;

            let alloc_elem = document.createElement('div');
            alloc_elem.className = "alloc";
            this.render_allocation_range(alloc, alloc_elem);
            this.make_collapsable(alloc_elem);
            if (alloc.ModuleName)
                alloc_elem.append(alloc.ModuleName);

            for (let item of alloc.Regions) {
                let elem = document.createElement('div');

                elem.append(item.BaseAddress.toString(16).padStart(12, '0'));
                elem.append(" " + MemoryFlags.FormatSize(item.RegionSize).padStart(6, '\u00A0'));
                elem.append(" " + MemoryFlags.FormatProtect(item.Protect).padEnd(8, '\u00A0'));

                // Memory state sets CSS class
                if (item.State == MemoryFlags.MEM_COMMIT) {
                    elem.className = "commit";
                } else if (item.State == MemoryFlags.MEM_RESERVE) {
                    elem.className = "reserve";
                } else {
                    elem.className = "unknown";
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
            elem.append(" " + item.Location.Length.toString().padStart(8, '\u00A0'));

            list.appendChild(elem);
        }
        dom.appendChild(list);
    }

    render_thread_list(thread_list, dom) {
        let list = document.createElement('ul');

        let threads = Array.from(thread_list);

        for (let item of threads) {
            let elem = document.createElement('li');
            elem.append('\u00A0\u00A0');
            elem.append("Thread[" + item.ThreadId.toString().padStart(5, 'u00A0') + "]");
            elem.append(" " + item.Context.Rip.toString(16).padStart(12, '0'));

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

        let threads_dom = document.createElement('div');
        threads_dom.className = "threads";
        let thread_list = JSON.parse(result.thread_list);
        this.render_thread_list(thread_list, threads_dom);
        this.body.append(threads_dom);
    }

    onmessage(e) {
        if (e.data.topic == 'result') {
            this.show_result(e.data);
        }
    }
}
