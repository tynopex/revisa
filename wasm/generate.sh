#!/bin/sh

TARGET=wasm32-unknown-unknown
SRC_DIR=target/${TARGET}/release
DST_DIR=../webui

# Release build
cargo \
    build \
    --target ${TARGET} \
    --release

# Strip dead code
wasm-gc ${SRC_DIR}/revisa_wasm.wasm

# Copy files to webui
cp ${SRC_DIR}/revisa_wasm.wasm ${DST_DIR}
