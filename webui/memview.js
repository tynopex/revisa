
// Describes a row of memory in UI
class MemoryRow {
    constructor(addr, data) {
        this.address = addr;
        this.rawdata = data;
    }
}

// The data accessor model
class MemoryData {
    constructor() {
        this.address = 0x0;
    }

    set_address(addr) {
        this.address = addr;
    }

    get_row(idx) {
        let stride = 16;
        let offset = idx * stride;

        let row_address = this.address + offset;
        let row_data = new Uint8Array(stride);

        return new MemoryRow(row_address, row_data);
    }
}

class MemoryViewer {
    constructor(control) {
        this.control = control;
        this.model = new MemoryData();

        this.nrow = 16;
        this.model.set_address(0x1000);
    }

    bind(elem) {
        this.dom = elem;
        this.dom.innerHTML = "";
        this.dom.className = 'memview';

        this.body = document.createElement('div');
        this.dom.appendChild(this.body);

        this.render(this.body);
    }

    render(dom) {
        let dom_mem = document.createElement('div');

        for (let i = 0; i < this.nrow; i += 1) {
            let dom_row = document.createElement('div');
            let dom_addr = document.createElement('span');
            let dom_data = document.createElement('span');

            dom_addr.className = "addr";
            dom_data.className = "data";

            let row = this.model.get_row(i);
            let addr_fmt = row.address.toString(16)
                                      .toUpperCase()
                                      .padStart(12, '0');
            let data_fmt = Array.from(row.rawdata)
                                .map(x => x.toString(16)
                                           .toUpperCase()
                                           .padStart(2, '0'))
                                .join(" ");

            dom_addr.append(addr_fmt);
            dom_data.append(data_fmt);
            dom_row.append(dom_addr, dom_data);
            dom_mem.append(dom_row);
        }

        dom.appendChild(dom_mem);
    }
}
