#!/bin/sh

#
# NOTE: The emcc configuration is found in .cargo/config
#

SRC_DIR="target/wasm32-unknown-emscripten/release"
DST_DIR="../webui"

# Release build
cargo build --release

# Copy files to webui
cp ${SRC_DIR}/revisa-wasm.js ${DST_DIR}
cp ${SRC_DIR}/revisa_wasm.wasm ${DST_DIR}
