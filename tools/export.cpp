#include <zlib.h>

#include <array>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <map>
#include <memory>
#include <sstream>
#include <string>
#include <vector>

#include "itch/framer.hpp"
#include "itch/snapshotter.hpp"

namespace {

std::vector<std::string> split(const std::string& s) {
  std::vector<std::string> out;
  std::stringstream ss(s);
  for (std::string part; std::getline(ss, part, ',');) out.push_back(part);
  return out;
}

std::string trim(const char* s, std::size_t n) {
  std::string out(s, n);
  while (!out.empty() && out.back() == ' ') out.pop_back();
  return out;
}

void print_levels(std::FILE* f, const std::array<itch::Level, 10>& levels, std::size_t count) {
  std::fputc('[', f);
  for (std::size_t i = 0; i < count; ++i)
    std::fprintf(f, "%s[%u,%llu]", i ? "," : "", levels[i].price, static_cast<unsigned long long>(levels[i].shares));
  std::fputc(']', f);
}

}  // namespace

int main(int argc, char** argv) {
  if (argc != 5) {
    std::fprintf(stderr, "usage: export <file.gz> <SYM,SYM,...> <interval_seconds> <out.json>\n");
    return 2;
  }
  const auto wanted = split(argv[2]);
  const std::uint64_t interval_ns = std::strtoull(argv[3], nullptr, 10) * 1'000'000'000ULL;
  gzFile in = gzopen(argv[1], "rb");
  if (in == nullptr) { std::fprintf(stderr, "cannot open %s\n", argv[1]); return 1; }
  gzbuffer(in, 1U << 20);

  itch::OrderBook book({});
  std::map<std::string, std::unique_ptr<itch::Snapshotter>> snaps;
  std::map<std::string, std::uint16_t> locates;
  std::array<std::uint64_t, 9> by_type{};
  std::array<std::uint64_t, 6> results{};
  std::uint64_t messages = 0;

  std::vector<std::byte> buffer(2U << 20);
  std::size_t held = 0;
  for (;;) {
    const int got = gzread(in, buffer.data() + held, static_cast<unsigned>(buffer.size() - held));
    if (got <= 0) break;
    const std::size_t have = held + static_cast<std::size_t>(got);
    const std::size_t used = itch::consume_frames(buffer.data(), have, [&](const std::byte* p, std::size_t n) {
      const itch::Event e = itch::parse(p, n);
      if (e.type == itch::EventType::Directory) {
        const std::string name = trim(e.stock, 8);
        for (const auto& w : wanted)
          if (w == name) {
            locates[name] = e.locate;
            snaps[name] = std::make_unique<itch::Snapshotter>(book, e.locate, interval_ns);
          }
      }
      for (auto& [name, s] : snaps) s->observe(e);
      ++by_type[static_cast<std::size_t>(e.type)];
      ++results[static_cast<std::size_t>(book.apply(e))];
      ++messages;
    });
    held = have - used;
    std::memmove(buffer.data(), buffer.data() + used, held);
  }
  gzclose(in);

  std::FILE* out = std::fopen(argv[4], "w");
  if (out == nullptr) return 1;
  std::fprintf(out, "{\"messages\":%llu,\"live_orders_end\":%zu,\"by_type\":{", static_cast<unsigned long long>(messages), book.live_orders());
  static const char* names[] = {"ignored", "malformed", "system", "directory", "add", "execute", "cancel", "delete", "replace"};
  for (std::size_t i = 0; i < by_type.size(); ++i) std::fprintf(out, "%s\"%s\":%llu", i ? "," : "", names[i], static_cast<unsigned long long>(by_type[i]));
  std::fprintf(out, "},\"book_errors\":%llu,\"per_minute\":[", static_cast<unsigned long long>(messages - results[0]));
  if (!snaps.empty()) {
    const auto& pm = snaps.begin()->second->messages_per_minute();
    for (std::size_t i = 0; i < pm.size(); ++i) std::fprintf(out, "%s%llu", i ? "," : "", static_cast<unsigned long long>(pm[i]));
  }
  std::fprintf(out, "],\"symbols\":{");
  bool first = true;
  for (auto& [name, s] : snaps) {
    std::fprintf(out, "%s\"%s\":{\"locate\":%u,\"snapshots\":[", first ? "" : ",", name.c_str(), locates[name]);
    first = false;
    bool first_snap = true;
    for (const auto& snap : s->snapshots()) {
      std::fprintf(out, "%s[%llu,", first_snap ? "" : ",", static_cast<unsigned long long>(snap.time_ns / 1'000'000'000ULL));
      first_snap = false;
      print_levels(out, snap.bids, snap.bid_count);
      std::fputc(',', out);
      print_levels(out, snap.asks, snap.ask_count);
      std::fputc(']', out);
    }
    std::fputs("]}", out);
  }
  std::fputs("}}\n", out);
  std::fclose(out);
  std::printf("messages %llu, symbols found:", static_cast<unsigned long long>(messages));
  for (const auto& [name, loc] : locates) std::printf(" %s(%u)", name.c_str(), loc);
  std::printf("\n");
  return 0;
}
