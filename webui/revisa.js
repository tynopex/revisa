
// WebUI Controller
class Revisa {
    constructor(elem) {
        this.dom = elem;
    }

    start() {
        this.view = new ViewLayout(this);

        this.minidump = new MinidumpViewer(this);
        this.memview = new MemoryViewer(this);

        let view = window.location.hash;
        this.select_view(view);
    }

    select_view(view) {
        // Default view
        if (!view) {
            this.view.minidump_view(this.minidump, this.memview);
            return;
        }

        if (view == "#minidump") {
            this.view.minidump_view(this.minidump, this.memview);
            return;
        }

        throw new Error("Unexpected view");
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

        let revisa = document.createTextNode("REVISA");

        this.breadcrumb = [revisa];
        this.render_breadcrumb();
    }

    init_body() {
        this.body = document.createElement('div');
    }

    minidump_view(minidump, memview) {
        this.breadcrumb.length = 1;
        this.breadcrumb.push("Minidump Viewer");
        this.render_breadcrumb();

        let dom_memview = document.createElement('div');
        memview.bind(dom_memview);

        let dom_minidump = document.createElement('div');
        minidump.bind(dom_minidump);

        this.body.append(dom_memview, dom_minidump);
    }
}


// Start UI on DOMContentLoaded event
document.addEventListener('DOMContentLoaded', function () {
    let elem = document.getElementById('revisa');
    let revisa = new Revisa(elem);
    revisa.start();
});
