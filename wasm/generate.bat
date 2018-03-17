SET TARGET=wasm32-unknown-unknown
SET SRC_DIR=target\%TARGET%\release
SET DST_DIR=..\webui

:: Release build
cargo ^
    build ^
    --target %TARGET% ^
    --release

:: Strip dead code
wasm-gc %SRC_DIR%\revisa_wasm.wasm

:: Copy files to webui
copy %SRC_DIR%\revisa_wasm.wasm %DST_DIR%
