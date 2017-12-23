
// WebUI Controller
class Revisa {
    constructor(elem) {
        this.dom = elem;
    }

    start() {
        this.view = new ViewLayout(this);

        this.landing = new LandingPage(this);
        this.console = new RemoteConsole(this);
        this.minidump = new MinidumpViewer(this);

        let view = window.location.hash;
        this.select_view(view);
    }

    select_view(view) {
        if (view == "#console") {
            this.view.console_view(this.console);

            // Connect automatically
            if (!this.console.remote)
                this.console.connect();
        }
        else if (view == "#minidump") {
            this.view.minidump_view(this.minidump);
        }
        else {
            this.view.landing_view(this.landing);

            // View should be ommited or '#' for landing page
            if (view && view != "#")
                throw new Error("Unexpected view");
        }
    }
}


// Top-level layout
class ViewLayout {
    constructor(control) {
        this.control = control;

        this.dom.innerHTML = "";

        this.init_header();
        this.dom.appendChild(this.header);

        this.init_body();
        this.dom.appendChild(this.body);
    }

    get dom() {
        return this.control.dom;
    }

    render_breadcrumb() {
        let docFrag = document.createDocumentFragment();
        docFrag.append(this.breadcrumb[0]);
        for (let i = 1; i < this.breadcrumb.length; i++)
            docFrag.append(" \u00BB ", this.breadcrumb[i]);
        docFrag.appendChild(document.createElement('hr'));

        this.header.innerHTML = "";
        this.header.appendChild(docFrag);
    }

    init_header() {
        this.header = document.createElement('div');
        this.header.className = 'header';

        // Initial breadcrumb is link to landing page
        let revisa = document.createElement('a');
        let text = document.createTextNode("REVISA");
        let view = "#";
        let self = this;
        revisa.href = view;
        revisa.onclick = function() {
            self.control.select_view(view);
        }
        revisa.appendChild(text);

        this.breadcrumb = [revisa];
        this.render_breadcrumb();
    }

    init_body() {
        this.body = document.createElement('div');
    }

    landing_view(landing) {
        this.breadcrumb.length = 1;
        this.render_breadcrumb();

        landing.bind(this.body);
    }

    console_view(console) {
        this.breadcrumb.length = 1;
        this.breadcrumb.push("Remote Console");
        this.render_breadcrumb();

        console.bind(this.body);
    }

    minidump_view(minidump) {
        this.breadcrumb.length = 1;
        this.breadcrumb.push("Minidump Viewer");
        this.render_breadcrumb();

        minidump.bind(this.body);
    }
}


// Navigation / Landing page
class LandingPage {
    constructor(control) {
        this.control = control;
    }

    bind(elem) {
        this.dom = elem;
        this.dom.innerHTML = "";
        this.dom.className = 'landing';

        this.list = document.createElement('ul');
        this.add_item("Remote Console", "#console");
        this.add_item("Minidump Viewer", "#minidump");
        this.dom.appendChild(this.list);
    }

    add_item(name, view) {
        let self = this;
        let item = document.createElement('li');
        let anchor = document.createElement('a');
        let text = document.createTextNode(name);
        anchor.href = view;
        anchor.onclick = function() {
            self.control.select_view(view);
        }
        anchor.appendChild(text);
        item.appendChild(anchor);
        this.list.appendChild(item);
    }
}


// Start UI on DOMContentLoaded event
document.addEventListener('DOMContentLoaded', function () {
    let elem = document.getElementById('revisa');
    let revisa = new Revisa(elem);
    revisa.start();
});
