#pragma once

#include <bit>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <vector>

#include "itch/parser.hpp"

namespace itch {

enum class Result : std::uint8_t { Ok, UnknownOrder, DuplicateOrder, Oversize, TableFull, BadLocate };

struct Level {
  std::uint64_t shares{0};
  std::uint32_t price{0};
  std::uint32_t orders{0};
};

struct OrderBookConfig {
  std::size_t order_capacity{1U << 24};
  std::size_t locates{1U << 16};
};

class OrderBook {
 public:
  explicit OrderBook(OrderBookConfig config)
      : mask_(std::bit_ceil(config.order_capacity < 4 ? 4 : config.order_capacity) - 1),
        shift_(64U - static_cast<unsigned>(std::countr_zero(mask_ + 1))),
        slots_(mask_ + 1),
        stocks_(config.locates) {}

  Result apply(const Event& e) noexcept {
    switch (e.type) {
      case EventType::Add: return add(e);
      case EventType::Execute:
      case EventType::Cancel: return reduce(e.ref, e.shares);
      case EventType::Delete: return remove(e.ref);
      case EventType::Directory: return prepare(e.locate);
      case EventType::Replace: return replace(e);
      default: return Result::Ok;
    }
  }

  std::optional<Level> best_bid(std::uint16_t locate) const noexcept { return best(locate, Side::Buy); }
  std::optional<Level> best_ask(std::uint16_t locate) const noexcept { return best(locate, Side::Sell); }

  std::size_t depth(std::uint16_t locate, Side side, Level* out, std::size_t max) const noexcept {
    if (locate >= stocks_.size()) return 0;
    const auto& v = levels(stocks_[locate], side);
    std::size_t n = 0;
    for (auto it = v.rbegin(); it != v.rend() && n < max; ++it) out[n++] = *it;
    return n;
  }

  void prefetch(const Event& e) const noexcept {
    if (e.type < EventType::Add) return;
    __builtin_prefetch(&slots_[ideal(e.ref)]);
    if (e.type == EventType::Replace) __builtin_prefetch(&slots_[ideal(e.new_ref)]);
  }

  std::size_t live_orders() const noexcept { return size_; }

 private:
  struct Slot {
    std::uint64_t ref{0};
    std::uint32_t price{0};
    std::uint32_t shares{0};
    std::uint16_t locate{0};
    std::uint8_t side{0};
    std::uint8_t used{0};
  };

  struct Stock {
    std::vector<Level> bids;
    std::vector<Level> asks;
  };

  static constexpr std::size_t kNone = ~std::size_t{0};
  static constexpr std::size_t kInitialLevels = 256;

  static std::vector<Level>& levels(Stock& s, Side side) noexcept { return side == Side::Buy ? s.bids : s.asks; }
  static const std::vector<Level>& levels(const Stock& s, Side side) noexcept {
    return side == Side::Buy ? s.bids : s.asks;
  }

  static bool better(Side side, std::uint32_t a, std::uint32_t b) noexcept {
    return side == Side::Buy ? a > b : a < b;
  }

  std::size_t ideal(std::uint64_t ref) const noexcept {
    return static_cast<std::size_t>((ref * 0x9E3779B97F4A7C15ULL) >> shift_);
  }

  std::size_t find(std::uint64_t ref) const noexcept {
    std::size_t i = ideal(ref);
    while (slots_[i].used) {
      if (slots_[i].ref == ref) return i;
      i = (i + 1) & mask_;
    }
    return kNone;
  }

  void erase_slot(std::size_t i) noexcept {
    std::size_t j = i;
    for (;;) {
      j = (j + 1) & mask_;
      if (!slots_[j].used) break;
      const std::size_t k = ideal(slots_[j].ref);
      const bool movable = j > i ? (k <= i || k > j) : (k <= i && k > j);
      if (movable) {
        slots_[i] = slots_[j];
        i = j;
      }
    }
    slots_[i].used = 0;
    --size_;
  }

  void level_add(Stock& stock, Side side, std::uint32_t price, std::uint32_t shares) {
    auto& v = levels(stock, side);
    if (v.capacity() == 0) v.reserve(kInitialLevels);
    std::size_t pos = v.size();
    while (pos > 0 && better(side, v[pos - 1].price, price)) --pos;
    if (pos > 0 && v[pos - 1].price == price) {
      v[pos - 1].shares += shares;
      ++v[pos - 1].orders;
      return;
    }
    v.insert(v.begin() + static_cast<std::ptrdiff_t>(pos), Level{shares, price, 1});
  }

  void level_reduce(Stock& stock, Side side, std::uint32_t price, std::uint32_t shares, bool order_gone) noexcept {
    auto& v = levels(stock, side);
    std::size_t pos = v.size();
    while (pos > 0 && v[pos - 1].price != price) --pos;
    auto& level = v[pos - 1];
    level.shares -= shares;
    if (order_gone) --level.orders;
    if (level.orders == 0) v.erase(v.begin() + static_cast<std::ptrdiff_t>(pos - 1));
  }

  Result insert(std::uint64_t ref, std::uint16_t locate, Side side, std::uint32_t price, std::uint32_t shares) {
    if (locate >= stocks_.size()) return Result::BadLocate;
    if (size_ >= mask_) return Result::TableFull;
    std::size_t i = ideal(ref);
    while (slots_[i].used) {
      if (slots_[i].ref == ref) return Result::DuplicateOrder;
      i = (i + 1) & mask_;
    }
    slots_[i] = Slot{ref, price, shares, locate, static_cast<std::uint8_t>(side), 1};
    ++size_;
    level_add(stocks_[locate], side, price, shares);
    return Result::Ok;
  }

  Result prepare(std::uint16_t locate) {
    if (locate >= stocks_.size()) return Result::BadLocate;
    stocks_[locate].bids.reserve(kInitialLevels);
    stocks_[locate].asks.reserve(kInitialLevels);
    return Result::Ok;
  }

  Result add(const Event& e) { return insert(e.ref, e.locate, e.side, e.price, e.shares); }

  Result reduce(std::uint64_t ref, std::uint32_t shares) noexcept {
    const std::size_t i = find(ref);
    if (i == kNone) return Result::UnknownOrder;
    Slot& s = slots_[i];
    if (shares > s.shares) return Result::Oversize;
    s.shares -= shares;
    const bool gone = s.shares == 0;
    level_reduce(stocks_[s.locate], static_cast<Side>(s.side), s.price, shares, gone);
    if (gone) erase_slot(i);
    return Result::Ok;
  }

  Result remove(std::uint64_t ref) noexcept {
    const std::size_t i = find(ref);
    if (i == kNone) return Result::UnknownOrder;
    const Slot s = slots_[i];
    level_reduce(stocks_[s.locate], static_cast<Side>(s.side), s.price, s.shares, true);
    erase_slot(i);
    return Result::Ok;
  }

  Result replace(const Event& e) {
    const std::size_t i = find(e.ref);
    if (i == kNone) return Result::UnknownOrder;
    if (find(e.new_ref) != kNone) return Result::DuplicateOrder;
    const Slot old = slots_[i];
    remove(e.ref);
    return insert(e.new_ref, old.locate, static_cast<Side>(old.side), e.price, e.shares);
  }

  std::optional<Level> best(std::uint16_t locate, Side side) const noexcept {
    if (locate >= stocks_.size()) return std::nullopt;
    const auto& v = levels(stocks_[locate], side);
    if (v.empty()) return std::nullopt;
    return v.back();
  }

  std::size_t mask_;
  unsigned shift_;
  std::size_t size_{0};
  std::vector<Slot> slots_;
  std::vector<Stock> stocks_;
};

}  // namespace itch
