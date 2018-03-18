
// WebUI Controller
class Revisa {
    constructor(elem) {
        this.dom = elem;
    }

    start() {
        this.view = new ViewLayout(this);

        this.minidump = new MinidumpViewer(this);

        let view = window.location.hash;
        this.select_view(view);
    }

    select_view(view) {
        if (view && view != "#minidump")
            throw new Error("Unexpected view");

        this.view.minidump_view(this.minidump);
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

    minidump_view(minidump) {
        this.breadcrumb.length = 1;
        this.breadcrumb.push("Minidump Viewer");
        this.render_breadcrumb();

        minidump.bind(this.body);
    }
}


// Start UI on DOMContentLoaded event
document.addEventListener('DOMContentLoaded', function () {
    let elem = document.getElementById('revisa');
    let revisa = new Revisa(elem);
    revisa.start();
});
