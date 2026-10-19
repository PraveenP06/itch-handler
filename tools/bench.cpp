#include <algorithm>
#include <array>
#include <atomic>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <new>
#include <thread>
#include <vector>

#include "itch/framer.hpp"
#include "itch/order_book.hpp"
#include "itch/spsc_ring.hpp"

namespace {
std::atomic<std::uint64_t> g_allocations{0};
}

void* operator new(std::size_t n) {
  g_allocations.fetch_add(1, std::memory_order_relaxed);
  if (void* p = std::malloc(n)) return p;
  throw std::bad_alloc();
}
void operator delete(void* p) noexcept { std::free(p); }
void operator delete(void* p, std::size_t) noexcept { std::free(p); }

namespace {

using Clock = std::chrono::steady_clock;

struct Ticks {
  static inline std::uint64_t now() noexcept {
#if defined(__aarch64__)
    std::uint64_t v;
    asm volatile("isb\n\tmrs %0, cntvct_el0" : "=r"(v));
    return v;
#else
    return static_cast<std::uint64_t>(Clock::now().time_since_epoch().count());
#endif
  }
  static double ns_per_tick() noexcept {
#if defined(__aarch64__)
    std::uint64_t f;
    asm volatile("mrs %0, cntfrq_el0" : "=r"(f));
    return 1e9 / static_cast<double>(f);
#else
    return 1.0;
#endif
  }
};

std::vector<std::byte> load(const char* path) {
  std::FILE* f = std::fopen(path, "rb");
  if (f == nullptr) { std::fprintf(stderr, "cannot open %s\n", path); std::exit(1); }
  std::fseek(f, 0, SEEK_END);
  const long size = std::ftell(f);
  std::fseek(f, 0, SEEK_SET);
  std::vector<std::byte> data(static_cast<std::size_t>(size));
  if (std::fread(data.data(), 1, data.size(), f) != data.size()) std::exit(1);
  std::fclose(f);
  return data;
}

constexpr std::uint64_t kNotMeasured = ~std::uint64_t{0};

struct Run {
  double seconds;
  std::uint64_t messages;
  std::uint64_t allocations;
  double mps() const { return static_cast<double>(messages) / seconds / 1e6; }
};

Run parse_only(const std::vector<std::byte>& d) {
  std::uint64_t n = 0, sink = 0;
  const auto t0 = Clock::now();
  itch::consume_frames(d.data(), d.size(), [&](const std::byte* p, std::size_t len) {
    const auto e = itch::parse(p, len);
    sink += e.ref + e.shares;
    ++n;
  });
  const double s = std::chrono::duration<double>(Clock::now() - t0).count();
  if (sink == 42) std::puts("");
  return {s, n, 0};
}

Run parse_and_book(const std::vector<std::byte>& d, std::vector<double>* batch_ns) {
  auto book = std::make_unique<itch::OrderBook>(itch::OrderBookConfig{});
  std::uint64_t n = 0, errors = 0;
  constexpr std::uint64_t kBatch = 32;
  constexpr std::uint64_t kWarmup = 100000;
  std::uint64_t batch_start = 0;
  const double tick = Ticks::ns_per_tick();
  std::uint64_t alloc0 = g_allocations.load();
  const auto t0 = Clock::now();
  itch::consume_frames(d.data(), d.size(), [&](const std::byte* p, std::size_t len) {
    if (n == kWarmup) alloc0 = g_allocations.load();
    if (batch_ns != nullptr && n % kBatch == 0) batch_start = Ticks::now();
    errors += book->apply(itch::parse(p, len)) != itch::Result::Ok;
    ++n;
    if (batch_ns != nullptr && n % kBatch == 0)
      batch_ns->push_back(static_cast<double>(Ticks::now() - batch_start) * tick / kBatch);
  });
  const double s = std::chrono::duration<double>(Clock::now() - t0).count();
  if (errors != 0) std::fprintf(stderr, "book errors: %llu\n", static_cast<unsigned long long>(errors));
  return {s, n, g_allocations.load() - alloc0};
}

Run parse_book_prefetch(const std::vector<std::byte>& d) {
  constexpr std::size_t kAhead = 8;
  auto book = std::make_unique<itch::OrderBook>(itch::OrderBookConfig{});
  std::array<itch::Event, kAhead> window{};
  std::uint64_t n = 0;
  const auto t0 = Clock::now();
  itch::consume_frames(d.data(), d.size(), [&](const std::byte* p, std::size_t len) {
    auto& slot = window[n % kAhead];
    if (n >= kAhead) book->apply(slot);
    slot = itch::parse(p, len);
    book->prefetch(slot);
    ++n;
  });
  for (std::size_t i = 0; i < kAhead && n >= kAhead; ++i) book->apply(window[(n + i) % kAhead]);
  const double s = std::chrono::duration<double>(Clock::now() - t0).count();
  return {s, n, kNotMeasured};
}

Run pipeline(const std::vector<std::byte>& d) {
  using Ring = itch::SpscRing<itch::Event, 1U << 16>;
  auto ring = std::make_unique<Ring>();
  auto book = std::make_unique<itch::OrderBook>(itch::OrderBookConfig{});
  std::atomic<bool> done{false};
  std::uint64_t consumed = 0;
  const std::uint64_t alloc0 = g_allocations.load();
  const auto t0 = Clock::now();
  std::thread consumer([&] {
    constexpr std::size_t kAhead = 8;
    std::array<itch::Event, kAhead> window{};
    std::uint64_t popped = 0;
    auto take = [&](const itch::Event& e) {
      auto& slot = window[popped % kAhead];
      if (popped >= kAhead) { book->apply(slot); ++consumed; }
      slot = e;
      book->prefetch(slot);
      ++popped;
    };
    auto drain = [&] {
      for (std::size_t i = 0; i < kAhead && popped >= kAhead; ++i) { book->apply(window[(popped + i) % kAhead]); ++consumed; }
      if (popped < kAhead) for (std::uint64_t i = 0; i < popped; ++i) { book->apply(window[i]); ++consumed; }
    };
    itch::Event e;
    for (;;) {
      if (ring->try_pop(e)) {
        take(e);
      } else if (done.load(std::memory_order_acquire)) {
        while (ring->try_pop(e)) take(e);
        drain();
        return;
      }
    }
  });
  itch::consume_frames(d.data(), d.size(), [&](const std::byte* p, std::size_t len) {
    const auto e = itch::parse(p, len);
    while (!ring->try_push(e)) {}
  });
  done.store(true, std::memory_order_release);
  consumer.join();
  const double s = std::chrono::duration<double>(Clock::now() - t0).count();
  (void)alloc0;
  return {s, consumed, kNotMeasured};
}

double pct(std::vector<double>& v, double p) {
  const auto i = static_cast<std::size_t>(p * static_cast<double>(v.size() - 1));
  return v[i];
}

template <typename F>
void report(const char* name, int runs, F&& f) {
  std::vector<Run> r;
  for (int i = 0; i < runs; ++i) r.push_back(f());
  std::sort(r.begin(), r.end(), [](const Run& a, const Run& b) { return a.mps() < b.mps(); });
  const auto allocs = r[r.size() / 2].allocations;
  std::printf("%-22s median %6.2f M msg/s  (min %.2f, max %.2f)  allocations after warm-up: ", name, r[r.size() / 2].mps(), r.front().mps(), r.back().mps());
  if (allocs == kNotMeasured) std::printf("n/a\n");
  else std::printf("%llu\n", static_cast<unsigned long long>(allocs));
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 2) { std::fprintf(stderr, "usage: bench <slice.itch> [runs]\n"); return 2; }
  const int runs = argc > 2 ? std::atoi(argv[2]) : 5;
  const auto data = load(argv[1]);
  std::printf("slice: %zu bytes, %u hardware threads, clock resolution %.1f ns\n", data.size(), std::thread::hardware_concurrency(), Ticks::ns_per_tick());
  report("parse only", runs, [&] { return parse_only(data); });
  report("parse + book", runs, [&] { return parse_and_book(data, nullptr); });
  report("parse + book + prefetch", runs, [&] { return parse_book_prefetch(data); });
  report("2-thread pipeline", runs, [&] { return pipeline(data); });

  std::vector<double> batches;
  batches.reserve(data.size() / 32 / 20);
  const auto run = parse_and_book(data, &batches);
  std::sort(batches.begin(), batches.end());
  std::printf("per-message latency, mean of 32-message batches (ns): p50 %.0f  p90 %.0f  p99 %.0f  p99.9 %.0f  max %.0f\n", pct(batches, 0.5),
              pct(batches, 0.9), pct(batches, 0.99), pct(batches, 0.999), batches.back());
  std::printf("allocations after the first 100k messages (stock setup): %llu over %llu messages\n", static_cast<unsigned long long>(run.allocations),
              static_cast<unsigned long long>(run.messages));
  return 0;
}
