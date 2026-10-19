#include <zlib.h>

#include <array>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>

#include "itch/framer.hpp"
#include "itch/order_book.hpp"

namespace {

struct Options {
  std::string path;
  std::string dump;
  std::uint64_t limit{~std::uint64_t{0}};
};

constexpr std::size_t kChunk = 1U << 20;

bool parse_args(int argc, char** argv, Options& o) {
  for (int i = 1; i < argc; ++i) {
    const std::string a = argv[i];
    if (a == "--limit" && i + 1 < argc) o.limit = std::strtoull(argv[++i], nullptr, 10);
    else if (a == "--dump" && i + 1 < argc) o.dump = argv[++i];
    else if (o.path.empty()) o.path = a;
    else return false;
  }
  return !o.path.empty();
}

}  // namespace

int main(int argc, char** argv) {
  Options opt;
  if (!parse_args(argc, argv, opt)) {
    std::fprintf(stderr, "usage: replay <file.gz|file.itch> [--limit N] [--dump out.itch]\n");
    return 2;
  }
  gzFile in = gzopen(opt.path.c_str(), "rb");
  if (in == nullptr) {
    std::fprintf(stderr, "cannot open %s\n", opt.path.c_str());
    return 1;
  }
  gzbuffer(in, 1U << 20);
  std::FILE* dump = opt.dump.empty() ? nullptr : std::fopen(opt.dump.c_str(), "wb");

  itch::OrderBook book({});
  std::array<std::uint64_t, 9> by_type{};
  std::array<std::uint64_t, 6> results{};
  std::uint64_t messages = 0, crossed_checks = 0, crossed = 0;
  std::vector<std::byte> buffer(2 * kChunk);
  std::size_t held = 0;
  bool done = false;

  const auto start = std::chrono::steady_clock::now();
  while (!done) {
    const int got = gzread(in, buffer.data() + held, static_cast<unsigned>(buffer.size() - held));
    if (got <= 0) break;
    const std::size_t have = held + static_cast<std::size_t>(got);
    std::size_t used = itch::consume_frames(buffer.data(), have, [&](const std::byte* p, std::size_t n) {
      if (done) return;
      const itch::Event e = itch::parse(p, n);
      ++by_type[static_cast<std::size_t>(e.type)];
      ++results[static_cast<std::size_t>(book.apply(e))];
      if (++messages >= opt.limit) done = true;
    });
    if (dump != nullptr) std::fwrite(buffer.data(), 1, used, dump);
    held = have - used;
    std::memmove(buffer.data(), buffer.data() + used, held);
  }
  const double secs = std::chrono::duration<double>(std::chrono::steady_clock::now() - start).count();
  gzclose(in);
  if (dump != nullptr) std::fclose(dump);

  for (std::uint16_t loc = 0; loc < 65535; ++loc) {
    const auto b = book.best_bid(loc), a = book.best_ask(loc);
    if (!b || !a) continue;
    ++crossed_checks;
    if (b->price >= a->price) ++crossed;
  }

  static const char* type_names[] = {"ignored", "malformed", "system", "directory", "add", "execute", "cancel", "delete", "replace"};
  static const char* result_names[] = {"ok", "unknown_order", "duplicate_order", "oversize", "table_full", "bad_locate"};
  std::printf("messages: %llu in %.2fs (%.2f M msg/s including gunzip)\n", static_cast<unsigned long long>(messages), secs,
              static_cast<double>(messages) / secs / 1e6);
  for (std::size_t i = 0; i < by_type.size(); ++i) std::printf("  %-10s %llu\n", type_names[i], static_cast<unsigned long long>(by_type[i]));
  for (std::size_t i = 0; i < results.size(); ++i) std::printf("  book:%-16s %llu\n", result_names[i], static_cast<unsigned long long>(results[i]));
  std::printf("live orders: %zu\n", book.live_orders());
  std::printf("stocks with two-sided book: %llu, crossed: %llu\n", static_cast<unsigned long long>(crossed_checks), static_cast<unsigned long long>(crossed));
  return 0;
}
