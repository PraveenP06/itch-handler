#pragma once

#include <cstddef>
#include <cstdint>
#include <map>
#include <optional>
#include <vector>

#include "live/l2_parser.hpp"

namespace live {

struct Level {
  std::int64_t price{0};
  double qty{0.0};
};

class L2Book {
 public:
  void set(BookSide side, std::int64_t price, double qty) {
    auto& levels = side == BookSide::Bid ? bids_ : asks_;
    if (qty <= 0.0) levels.erase(price);
    else levels[price] = qty;
  }

  void clear() {
    bids_.clear();
    asks_.clear();
  }

  std::optional<Level> best_bid() const {
    if (bids_.empty()) return std::nullopt;
    const auto& top = *bids_.rbegin();
    return Level{top.first, top.second};
  }

  std::optional<Level> best_ask() const {
    if (asks_.empty()) return std::nullopt;
    const auto& top = *asks_.begin();
    return Level{top.first, top.second};
  }

  std::vector<Level> depth(BookSide side, std::size_t count) const {
    std::vector<Level> out;
    out.reserve(count);
    if (side == BookSide::Bid) {
      for (auto it = bids_.rbegin(); it != bids_.rend() && out.size() < count; ++it) out.push_back({it->first, it->second});
    } else {
      for (auto it = asks_.begin(); it != asks_.end() && out.size() < count; ++it) out.push_back({it->first, it->second});
    }
    return out;
  }

  std::size_t level_count() const noexcept { return bids_.size() + asks_.size(); }

  bool crossed() const {
    const auto b = best_bid(), a = best_ask();
    return b && a && b->price >= a->price;
  }

 private:
  std::map<std::int64_t, double> bids_;
  std::map<std::int64_t, double> asks_;
};

}  // namespace live
