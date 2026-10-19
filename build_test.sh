#!/bin/sh
set -e
cmake -S . -B build -G Ninja >/dev/null
cmake --build build 2>&1 | tail -15
./build/itch_tests
