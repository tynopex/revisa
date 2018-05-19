
// Describes a row of memory in UI
class MemoryRow {
    constructor(addr, data) {
        this.address = addr;
        this.rawdata = data;
    }
}

// The data accessor model
class MemoryData {
    constructor(nrow = 10) {
        this.address = 0x0;
        this.limit = 0x1000000000000;
        this.stride = 16;
        this.nrow = nrow;
        this.observers = {};
    }

    subscribe(topic, cb) {
        topic = topic.toString();

        if (!this.observers[topic]) {
            this.observers[topic] = [];
        }

        this.observers[topic].push(cb);
    }

    publish(topic, ...args) {
        topic = topic.toString();

        let listeners = this.observers[topic];

        if (listeners) {
            for (let cb of listeners) {
                cb(...args);
            }
        }
    }

    set_address(addr, row = 0) {
        this.address = addr - (row * this.stride);

        if (this.address < 0) {
            this.address = 0;
        }

        if (this.address + (this.nrow * this.stride) > this.limit) {
            this.address = this.limit - (this.nrow * this.stride);
        }

        this.publish("address", this.address);
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

        this.nrow = 20;

        this.model = new MemoryData(this.nrow);
        this.model.set_address(0);
    }

    bind(elem) {
        this.dom = elem;
        this.dom.innerHTML = "";
        this.dom.className = 'memview';

        this.body = document.createElement('div');
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
            let dom_row = document.createElement('div');
            let dom_addr = document.createElement('input');
            let dom_data = document.createElement('span');

            dom_row.row = i;

            dom_addr.className = "addr";
            dom_addr.type = 'text';
            dom_addr.addEventListener('change', ev => {
                this.set_address(ev.target.value, i);
            });

            dom_data.className = "data";

            let update_fn = _ => {
                let row = this.model.get_row(i);

                let addr_fmt = row.address.toString(16)
                                          .toUpperCase()
                                          .padStart(12, '0');

                let data_fmt = Array.from(row.rawdata)
                                    .map(x => x.toString(16)
                                            .toUpperCase()
                                            .padStart(2, '0'))
                                    .join(" ");

                dom_addr.value = addr_fmt;
                dom_data.textContent = data_fmt;
            };

            this.model.subscribe("address", update_fn);

            update_fn();

            dom_row.append(dom_addr, dom_data);
            dom.append(dom_row);
        }
    }
}
