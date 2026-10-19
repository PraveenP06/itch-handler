#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <vector>

#include "itch/order_book.hpp"

namespace itch {

struct Snapshot {
  std::uint64_t time_ns{0};
  std::size_t bid_count{0};
  std::size_t ask_count{0};
  std::array<Level, 10> bids{};
  std::array<Level, 10> asks{};
};

class Snapshotter {
 public:
  static constexpr std::size_t kDepth = 10;

  Snapshotter(const OrderBook& book, std::uint16_t locate, std::uint64_t interval_ns)
      : book_(book), locate_(locate), interval_(interval_ns) {}

  void observe(const Event& e) {
    if (e.timestamp_ns == 0) return;
    count_message(e.timestamp_ns);
    if (next_boundary_ == 0) next_boundary_ = (e.timestamp_ns / interval_ + 1) * interval_;
    while (e.timestamp_ns >= next_boundary_) {
      snapshots_.push_back(take(next_boundary_));
      next_boundary_ += interval_;
    }
  }

  const std::vector<Snapshot>& snapshots() const noexcept { return snapshots_; }
  const std::vector<std::uint64_t>& messages_per_minute() const noexcept { return per_minute_; }

 private:
  static constexpr std::uint64_t kMinuteNs = 60ULL * 1'000'000'000ULL;

  void count_message(std::uint64_t time_ns) {
    const auto minute = static_cast<std::size_t>(time_ns / kMinuteNs);
    if (minute >= per_minute_.size()) per_minute_.resize(minute + 1, 0);
    ++per_minute_[minute];
  }

  Snapshot take(std::uint64_t time_ns) const {
    Snapshot s;
    s.time_ns = time_ns;
    s.bid_count = book_.depth(locate_, Side::Buy, s.bids.data(), kDepth);
    s.ask_count = book_.depth(locate_, Side::Sell, s.asks.data(), kDepth);
    return s;
  }

  const OrderBook& book_;
  std::uint16_t locate_;
  std::uint64_t interval_;
  std::uint64_t next_boundary_{0};
  std::vector<Snapshot> snapshots_;
  std::vector<std::uint64_t> per_minute_;
};

}  // namespace itch
