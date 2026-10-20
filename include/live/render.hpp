#pragma once

#include <cstdint>
#include <cstdio>
#include <string>
#include <vector>

#include "live/l2_book.hpp"

namespace live {

struct BookView {
  std::vector<Level> bids;
  std::vector<Level> asks;
  std::uint64_t messages{0};
  std::uint64_t updates{0};
  std::uint64_t snapshots{0};
  std::uint64_t gaps{0};
  std::uint64_t crossed_events{0};
  std::uint64_t last_sequence{0};
  std::uint64_t levels{0};
  std::uint64_t p50_ns{0};
  std::uint64_t p99_ns{0};
  double msgs_per_sec{0.0};
  double uptime_s{0.0};
};

inline std::string format_price(std::int64_t ticks) {
  const std::int64_t whole = ticks / 100'000'000LL;
  const std::int64_t frac = ticks % 100'000'000LL;
  char buf[40];
  std::snprintf(buf, sizeof buf, "%lld.%08lld", static_cast<long long>(whole), static_cast<long long>(frac));
  std::string s(buf);
  while (s.size() > 2 && s.back() == '0' && s[s.size() - 3] != '.') s.pop_back();
  return s;
}

inline std::string format_qty(double q) {
  char buf[40];
  std::snprintf(buf, sizeof buf, "%.8g", q);
  return buf;
}

inline void append_levels(std::string& out, const std::vector<Level>& levels) {
  out += '[';
  for (std::size_t i = 0; i < levels.size(); ++i) {
    if (i != 0) out += ',';
    out += "[\"" + format_price(levels[i].price) + "\"," + format_qty(levels[i].qty) + ']';
  }
  out += ']';
}

inline std::string render_json(const BookView& v, std::uint64_t age_ms) {
  std::string out = "{\"bids\":";
  append_levels(out, v.bids);
  out += ",\"asks\":";
  append_levels(out, v.asks);
  char tail[512];
  std::snprintf(tail, sizeof tail,
                ",\"messages\":%llu,\"updates\":%llu,\"snapshots\":%llu,\"gaps\":%llu,\"crossed_events\":%llu,\"last_sequence\":%llu,"
                "\"levels\":%llu,\"p50_ns\":%llu,\"p99_ns\":%llu,\"msgs_per_sec\":%.1f,\"uptime_s\":%.1f,\"age_ms\":%llu}",
                static_cast<unsigned long long>(v.messages), static_cast<unsigned long long>(v.updates),
                static_cast<unsigned long long>(v.snapshots), static_cast<unsigned long long>(v.gaps),
                static_cast<unsigned long long>(v.crossed_events), static_cast<unsigned long long>(v.last_sequence),
                static_cast<unsigned long long>(v.levels), static_cast<unsigned long long>(v.p50_ns),
                static_cast<unsigned long long>(v.p99_ns), v.msgs_per_sec, v.uptime_s, static_cast<unsigned long long>(age_ms));
  out += tail;
  return out;
}

}  // namespace live
