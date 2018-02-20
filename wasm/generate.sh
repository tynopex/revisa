#!/bin/sh

SRC_DIR="target/wasm32-unknown-unknown/release"
DST_DIR="../webui"

# Release build
cargo \
    build \
    --target wasm32-unknown-unknown \
    --release

# Strip dead code
wasm-gc ${SRC_DIR}/revisa_wasm.wasm

# Copy files to webui
cp ${SRC_DIR}/revisa_wasm.wasm ${DST_DIR}
