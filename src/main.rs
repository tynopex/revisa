extern crate futures;
extern crate hyper;

mod api;

use api::WebUi;

fn main() {
    let ui_serv = WebUi::new();

    ui_serv.run();
}
