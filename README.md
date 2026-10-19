# itch-handler

A C++20 NASDAQ ITCH 5.0 feed handler and limit order book. It replays a real full day of NASDAQ order-by-order data (Level 3), rebuilds every stock's book, and measures how fast it does that.

## What is here
- `include/itch/parser.hpp`: zero-allocation decoder for the order-book-relevant ITCH 5.0 messages (S, R, A, F, E, C, X, D, U).
- `include/itch/framer.hpp`: splits the length-prefixed byte stream into messages.
- `include/itch/order_book.hpp`: order book with a preallocated open-addressing order table and per-stock sorted price levels.
- `include/itch/spsc_ring.hpp`: lock-free single-producer single-consumer ring buffer.
- `tools/replay.cpp`: streams a `.gz` ITCH file through the parser and book and prints message and error counts.
- `tools/bench.cpp`: throughput and latency benchmark on an in-memory slice.

## Build and test
```
cmake -S . -B build -G Ninja
cmake --build build
./build/itch_tests
```
Sanitizer builds: `-DITCH_SANITIZE=address,undefined` or `-DITCH_SANITIZE=thread` with `-DCMAKE_BUILD_TYPE=Debug`.

## Data
Free NASDAQ sample files: https://emi.nasdaq.com/ITCH/Nasdaq%20ITCH/ (this project was run on `S112825-v50.txt.gz`, 28 Nov 2025). Files are not stored in the repo.

## Correctness
- Unit tests for every message type and book operation.
- A randomised test checks the book against a simple `std::map` reference after every step.
- A full-day replay of 353,357,889 messages produced zero unknown-order, duplicate, oversize or table-full results, and the book ended with no live orders.
- Open question: a few thinly traded stocks show a locked or crossed book after some adds. The cause (likely halted or newly listed symbols) has not been verified.

## Performance
Final benchmark numbers will be added once measured on a quiet, plugged-in machine. Any figure in this file is measured, with the machine and date stated.
