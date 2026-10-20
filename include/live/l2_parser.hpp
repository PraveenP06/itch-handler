#pragma once

#include <charconv>
#include <cstdint>
#include <optional>
#include <string_view>

namespace live {

enum class BookSide : std::uint8_t { Bid, Ask };

struct L2Header {
  bool valid{false};
  bool snapshot{false};
  std::uint64_t sequence{0};
};

inline constexpr int kPriceDecimals = 8;

inline std::int64_t parse_price(std::string_view s) noexcept {
  if (s.empty()) return -1;
  std::int64_t whole = 0;
  std::size_t i = 0;
  for (; i < s.size() && s[i] != '.'; ++i) {
    if (s[i] < '0' || s[i] > '9') return -1;
    whole = whole * 10 + (s[i] - '0');
  }
  std::int64_t frac = 0;
  int digits = 0;
  if (i < s.size()) {
    for (++i; i < s.size() && digits < kPriceDecimals; ++i, ++digits) {
      if (s[i] < '0' || s[i] > '9') return -1;
      frac = frac * 10 + (s[i] - '0');
    }
  }
  for (; digits < kPriceDecimals; ++digits) frac *= 10;
  return whole * 100'000'000LL + frac;
}

namespace detail {

inline std::string_view value_after(std::string_view text, std::string_view key, std::size_t& from) noexcept {
  const auto at = text.find(key, from);
  if (at == std::string_view::npos) return {};
  const auto start = at + key.size();
  const auto end = text.find('"', start);
  if (end == std::string_view::npos) return {};
  from = end + 1;
  return text.substr(start, end - start);
}

}  // namespace detail

inline std::optional<std::uint64_t> parse_sequence(std::string_view line) noexcept {
  const auto at = line.find(R"("sequence_num":)");
  if (at == std::string_view::npos) return std::nullopt;
  std::uint64_t seq = 0;
  const char* begin = line.data() + at + 15;
  if (std::from_chars(begin, line.data() + line.size(), seq).ec != std::errc{}) return std::nullopt;
  return seq;
}

inline L2Header parse_l2_header(std::string_view line) noexcept {
  L2Header header;
  if (line.find(R"("channel":"l2_data")") == std::string_view::npos) return header;
  const auto seq_at = line.find(R"("sequence_num":)");
  if (seq_at == std::string_view::npos) return header;
  const char* begin = line.data() + seq_at + 15;
  const char* end = line.data() + line.size();
  std::uint64_t seq = 0;
  if (std::from_chars(begin, end, seq).ec != std::errc{}) return header;
  header.valid = true;
  header.sequence = seq;
  std::size_t pos = 0;
  header.snapshot = detail::value_after(line, R"("type":")", pos) == "snapshot";
  return header;
}

template <typename OnUpdate>
inline L2Header parse_l2(std::string_view line, OnUpdate&& on_update) noexcept(noexcept(on_update(BookSide::Bid, std::int64_t{}, 0.0))) {
  const L2Header header = parse_l2_header(line);
  if (!header.valid) return header;
  std::size_t pos = 0;

  for (;;) {
    const auto side = detail::value_after(line, R"("side":")", pos);
    if (side.empty()) break;
    const auto price = detail::value_after(line, R"("price_level":")", pos);
    const auto qty = detail::value_after(line, R"("new_quantity":")", pos);
    if (price.empty() || qty.empty()) break;
    const std::int64_t ticks = parse_price(price);
    double q = 0.0;
    if (ticks < 0 || std::from_chars(qty.data(), qty.data() + qty.size(), q).ec != std::errc{}) continue;
    on_update(side == "bid" ? BookSide::Bid : BookSide::Ask, ticks, q);
  }
  return header;
}

}  // namespace live
