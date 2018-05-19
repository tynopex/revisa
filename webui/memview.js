
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
        this.stride = 16;
    }

    set_address(addr, row = 0) {
        this.address = addr - (row * this.stride);
    }

    get_row(idx) {
        let offset = idx * this.stride;

        let row_address = this.address + offset;
        let row_data = new Uint8Array(this.stride);

        return new MemoryRow(row_address, row_data);
    }
}

class MemoryViewer {
    constructor(control) {
        this.control = control;
        this.model = new MemoryData();

        this.model.set_address(0);
        this.nrow = 16;
    }

    bind(elem) {
        this.dom = elem;
        this.dom.innerHTML = "";
        this.dom.className = 'memview';

        this.body = document.createElement('div');
        this.dom.appendChild(this.body);

        this.render();
    }

    set_address(addr, row = 0) {
        let addr_num = Number.parseInt(addr, 16);
        this.model.set_address(addr_num, row);
    }

    render() {
        this.render_rows(this.body);
    }

    render_rows(dom) {
        // Clear old render
        dom.innerHTML = "";

        for (let i = 0; i < this.nrow; i += 1) {
            let dom_row = document.createElement('div');
            let dom_addr = document.createElement('input');
            let dom_data = document.createElement('span');

            let row = this.model.get_row(i);
            let addr_fmt = row.address.toString(16)
                                      .toUpperCase()
                                      .padStart(12, '0');
            dom_addr.className = "addr";
            dom_addr.type = 'text';
            dom_addr.value = addr_fmt;
            dom_addr.addEventListener('change', ev => {
                this.set_address(ev.target.value, i);
                this.render();
            });

            let data_fmt = Array.from(row.rawdata)
                                .map(x => x.toString(16)
                                           .toUpperCase()
                                           .padStart(2, '0'))
                                .join(" ");
            dom_data.className = "data";
            dom_data.append(data_fmt);

            dom_row.append(dom_addr, dom_data);
            dom.append(dom_row);
        }
    }
}
