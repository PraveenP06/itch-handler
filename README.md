# itch-handler

A C++20 NASDAQ ITCH 5.0 feed handler and limit order book. It replays a real full day of NASDAQ order-by-order data (Level 3), rebuilds every stock's book, and measures how fast it does that.

## What is here
- `include/itch/parser.hpp`: zero-allocation decoder for the order-book-relevant ITCH 5.0 messages (S, R, A, F, E, C, X, D, U).
- `include/itch/framer.hpp`: splits the length-prefixed byte stream into messages.
- `include/itch/order_book.hpp`: order book with a preallocated open-addressing order table and per-stock sorted price levels.
- `include/itch/spsc_ring.hpp`: lock-free single-producer single-consumer ring buffer.
- `tools/replay.cpp`: streams a `.gz` ITCH file through the parser and book and prints message and error counts.
- `tools/bench.cpp`: throughput and latency benchmark on an in-memory slice.

## Live mode (Coinbase BTC-USD, Level 2)
A second program, `live_book`, rebuilds a live book from Coinbase's public `l2_data` feed. A separate Python process (`orderbook-lab stream`) holds the websocket and writes one raw message per line to stdout; `live_book` reads them from stdin, parses the JSON with a hand-written scanner, applies the price-level changes, and serves a JSON endpoint (`/book`) plus a live page (`/`).

```
orderbook-lab stream --product BTC-USD | ./build/live_book --bind 127.0.0.1 --port 8080
```
It listens on localhost only by default. On the droplet it runs as a systemd service and is viewed through an SSH tunnel.

- `include/live/l2_parser.hpp`, `l2_book.hpp`, `live_stats.hpp`, `render.hpp`: parser, book, sequence-gap and latency tracking, JSON rendering. All unit tested.
- Verified by replaying 2,764,755 recorded messages (60,076,531 level updates, 87 snapshots) through `live_book --dump-final`: the final best bid and ask match the Python replay of the same recordings exactly, with zero sequence gaps and zero crossed books.
- A bug found on the way: the feed shares one sequence counter between the book and heartbeat channels, so counting only book messages reported tens of thousands of false gaps. Sequence tracking now looks at every message.
- This is Level 2 (totals per price), not order by order, and it is live crypto data, not ITCH. The reported latency is the engine's parse and apply time per message, not network latency.

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
Measured 19 Oct 2026 on an Apple M4 (10 cores, 16 GB, AC power), Apple clang 21, `-O3 -mcpu=native`. Input is the first 60,054,539 messages of `S112825-v50.txt.gz`, decompressed to memory first, so gunzip is excluded. Median of 7 runs; the range is the min and max run. Chrome was running in the background at modest load.

| Stage | Throughput (M msg/s) | Range |
|---|---|---|
| Parse only | 221 | 122 to 222 (first run is cold) |
| Parse + book update | 12.2 | 11.4 to 12.3 |
| Parse + book update + prefetch of the order-table slot | 15.8 | 15.6 to 15.8 |
| Two-thread pipeline (parser thread, SPSC ring, book thread, with prefetch) | 14.1 | 12.8 to 14.6 |

Per-message latency, parse + book update (without prefetch), taken as the mean over 32-message batches because one message is faster than a reliable single timing: p50 57 ns, p90 125 ns, p99 590 ns, p99.9 1,758 ns, max 3,962 ns. The timer is the ARM generic counter at 1 ns resolution.

Memory allocations after the first 100,000 messages (stock setup): 1,216 over 60 million messages, which is close to zero but not zero. They come from stocks whose price levels outgrow the reserved capacity.

What the numbers say:
- Parsing is cheap. The book update dominates. The gain from prefetching suggests cache misses on the 16M-entry order table are a large part of it (not profiled).
- Prefetching the order-table slot a few messages ahead improved single-thread throughput by about 30%.
- The two-thread pipeline is slower than the single thread with prefetch. Likely the cost of passing 48-byte events through the ring outweighs the parse work it takes off the book thread (not profiled).
- Full day, including gunzip, single thread, no prefetch in the replay tool: 353,357,889 messages in 44.6 s (7.9 M msg/s).

Not measured: wire-to-book latency over a network, SIMD parsing, or CPU pinning. macOS offers no thread pinning and `rdtsc`/AVX-512 are x86 only.
