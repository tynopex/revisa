
// Describes a row of memory in UI
class MemoryRow {
    constructor(addr, data) {
        this.address = addr;
        this.rawdata = data;
    }
}

// The data accessor model
class MemoryData {
    constructor(control, nrow = 10) {
        this.control = control;
        this.address = 0x0;
        this.limit = 0x1000000000000;
        this.stride = 16;
        this.nrow = nrow;
        this.dumpfile = null;

        this.control.subscribe("minidump", (raw, result) => {
            this.dumpfile = new Uint8Array(raw);

            // Sorted from highest start address to lowest
            this.ranges = JSON.parse(result.memory_range);
            this.ranges.sort((l,r) => (l.Address - r.Address));
            this.ranges.reverse();

            this.control.publish("data_change");
        });
    }

    set_address(addr, row = 0) {
        this.address = addr - (row * this.stride);

        if (this.address < 0) {
            this.address = 0;
        }

        if (this.address + (this.nrow * this.stride) > this.limit) {
            this.address = this.limit - (this.nrow * this.stride);
        }

        this.control.publish("memory_address", this.address);
    }

    get_byte(addr) {
        if (!this.dumpfile) {
            return "??";
        }

        // Find first range who's start address is smaller than target
        let range = this.ranges.find(el => el.Address <= addr);
        if (!range) {
            return "??";
        }

        // Check bounds of the region
        let offset = addr - range.Address;
        if (offset >= range.Location.Length) {
            return "??";
        }

        // Read byte out of file
        return this.dumpfile[range.Location.Offset + offset];
    }

    get_row(idx) {
        let offset = idx * this.stride;

        let row_address = this.address + offset;
        let row_data = new Array(this.stride);

        for (let i = 0; i < this.stride; i += 1) {
            row_data[i] = this.get_byte(row_address + i);
        }

        return new MemoryRow(row_address, row_data);
    }
}

class MemoryViewer {
    constructor(control) {
        this.control = control;

        this.nrow = 20;

        this.model = new MemoryData(this.control, this.nrow);
        this.model.set_address(0);

        // Set address to fault address on minidump load
        this.control.subscribe("minidump", (raw, result) => {
            let exception_record = JSON.parse(result.exception_record);
            let fault_addr = exception_record.Exception.Address;
            this.model.set_address(fault_addr, this.nrow / 2);
        });
    }

    set_data_source(source) {
        this.data_source = source;
    }

    bind(elem) {
        this.dom = elem;
        this.dom.innerHTML = "";
        this.dom.className = 'memview';

        this.body = document.createElement('table');
        this.build_rows(this.body, this.nrow);
        this.dom.appendChild(this.body);
    }

    set_address(addr, row = 0) {
        let addr_num = Number.parseInt(addr, 16);
        this.model.set_address(addr_num, row);
    }

    build_rows(dom, nrow) {
        // Clear old render
        dom.innerHTML = "";

        for (let i = 0; i < nrow; i += 1) {
            let dom_row = document.createElement('tr');
            let dom_addr_cell = document.createElement('td');
            let dom_data_cell = document.createElement('td');
            let dom_addr = document.createElement('input');
            let dom_data = document.createElement('span');

            dom_row.row = i;

            let update_fn = _ => {
                let row = this.model.get_row(i);

                let addr_fmt = row.address.toString(16)
                                          .toUpperCase();

                // Zero-pad addresses unless they are focused
                if (document.activeElement !== dom_addr) {
                    addr_fmt = addr_fmt.padStart(12, '0');
                }

                let data_fmt = Array.from(row.rawdata)
                                    .map(x => x.toString(16)
                                            .toUpperCase()
                                            .padStart(2, '0'))
                                    .join(" ");

                dom_addr.value = addr_fmt;
                dom_data.textContent = data_fmt;
            };

            dom_addr.className = "addr";
            dom_addr.type = 'text';
            dom_addr.addEventListener('change', ev => {
                this.set_address(ev.target.value, i);
            });
            dom_addr.addEventListener('focus', _ => {
                update_fn();
            });
            dom_addr.addEventListener('blur', _ => {
                update_fn();
            });
            this.control.subscribe("memory_address", update_fn);
            this.control.subscribe("data_change", update_fn);
            update_fn();

            dom_data.className = "data";

            dom_addr_cell.append(dom_addr);
            dom_data_cell.append(dom_data);
            dom_row.append(dom_addr_cell, dom_data_cell);
            dom.append(dom_row);
        }
    }
}
