
// WebUI Controller
class Revisa {
    constructor(elem) {
        this.dom = elem;
    }

    start() {
        this.view = new ViewLayout(this);

        let console = new RemoteConsole(this);
        this.view.console_view(console);

        console.connect();
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

        this.breadcrumb = ["REVISA"];
        this.render_breadcrumb();
    }

    init_body() {
        this.body = document.createElement('div');
    }

    console_view(console) {
        this.breadcrumb.length = 1;
        this.breadcrumb.push("Remote Console");
        this.render_breadcrumb();

        console.bind(this.body);
    }
}


// Console to REVISA server
class RemoteConsole {
    constructor(control) {
        this.control = control;
        this.scrollback = [];
    }

    bind(elem) {
        this.dom = elem;
        this.dom.innerHTML = "";
        this.dom.className = 'console';

        this.text = document.createElement('textarea');
        this.text.readOnly = true;
        this.dom.appendChild(this.text);

        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.addEventListener('keyup', (ev) => this.keyUp(ev), false);
        this.dom.appendChild(this.input);

        this.input.focus();
    }

    render() {
        if (!this.text)
            return;

        this.text.value = this.scrollback.join('\n');
        this.text.scrollTop = this.text.scrollHeight;
    }

    write_scrollback(msg) {
        this.scrollback.push(msg);
        this.render();
    }

    write_scrollback_multi(msgs) {
        this.scrollback = this.scrollback.concat(msgs);
        this.render();
    }

    sendCommand(text) {
        if (text == "")
            return;

        if (this.remote) {
            this.remote.command(text, (msgs) => this.write_scrollback_multi(msgs));
        } else {
            this.write_scrollback("[RemoteConsole] No remote connected");
        }
    }

    keyUp(ev) {
        if (ev.key == 'Enter') {
            let text = this.input.value;
            this.input.value = "";
            this.sendCommand(text);
        }
    }

    connect() {
        this.write_scrollback("[RemoteConsole] Connecting to Remote ...");

        this.remote = new RevisaRemote();
        this.remote.command('hello', (msgs) => this.write_scrollback_multi(msgs));
    }
}


// Dummy remote running on client
class DummyRemote {
    command(cmd, cb) {
        if (cmd == 'hello') {
            let result = ["[DummyRemote] Hello!"];
            cb(result);
        } else {
            let result = ["[DummyRemote] Unknown command: `" + cmd + "`"];
            cb(result);
        }
    }
}


// Remote connection to REVISA server
class RevisaRemote {
    command(cmd, cb) {
        let req = new XMLHttpRequest();
        req.open('POST', "http://localhost:8080/cmd");
        req.timeout = 2000;
        req.responseType = "json";
        req.onload = (() => this.onload(req, cb));
        req.onerror = (() => this.onerror(req, cb));
        req.ontimeout = (() => this.ontimeout(req, cb));
        req.send(cmd);
    }

    onload(xhr, cb) {
        if (xhr.response && 'result' in xhr.response) {
            let output = ["[RevisaRemote] " + xhr.response['result']];
            cb(output);
        } else {
            let result = ["[RevisaRemote] Bad response format!"];
            cb(result);
        }
    }

    onerror(xhr, cb) {
        let result = ["[RevisaRemote] Error!"];
        cb(result);
    }

    ontimeout(xhr, cb) {
        let result = ["[RevisaRemote] Timed out!"];
        cb(result);
    }
}


// Start UI on DOMContentLoaded event
document.addEventListener('DOMContentLoaded', function () {
    let elem = document.getElementById('revisa');
    let revisa = new Revisa(elem);
    revisa.start();
});
