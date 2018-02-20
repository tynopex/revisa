use std::net::SocketAddr;

use futures::future::{self, Future};
use hyper::{self, StatusCode, Method};
use hyper::header::{ContentType, ContentLength, AccessControlAllowOrigin};
use hyper::server::{Http, Service};


pub struct WebUi {
    addr: SocketAddr,
}

struct WebUiService;

impl WebUi {
    pub fn new() -> WebUi {
        let addr = "127.0.0.1:8080".parse().unwrap();
        WebUi { addr }
    }

    pub fn run(&self) {
        let server = Http::new()
            .bind(&self.addr, || Ok(WebUiService))
            .unwrap();

        println!("Listening on http://{}", server.local_addr().unwrap());
        server.run().unwrap();
    }
}

impl Service for WebUiService {
    type Request = hyper::Request;
    type Response = hyper::Response;
    type Error = hyper::Error;

    type Future = Box<Future<Item=Self::Response, Error=Self::Error>>;

    fn call(&self, req: Self::Request) -> Self::Future {
        let mut response = Self::Response::new();

        match (req.method(), req.path()) {
            (&Method::Get, "/") => {
                response.set_body("REVISA Server");
            },
            (&Method::Post, "/cmd") => {
                self.handle_command(&mut response);
            },
            _ => {
                response.set_status(StatusCode::NotFound);
            }
        };

        Box::new(future::ok(response))
    }
}

impl WebUiService {
    fn handle_command(&self, response: &mut <Self as Service>::Response) {
        const REPLY_JSON: &'static str = "{\"result\": \"Hello!\"}";

        response.headers_mut().set(ContentType::json());
        response.headers_mut().set(ContentLength(REPLY_JSON.len() as u64));
        response.headers_mut().set(AccessControlAllowOrigin::Any);
        response.set_body(REPLY_JSON);
    }
}
