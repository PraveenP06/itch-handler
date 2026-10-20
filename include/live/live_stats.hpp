#pragma once

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <vector>

namespace live {

class LiveStats {
 public:
  void on_sequence(std::uint64_t sequence, bool snapshot) noexcept {
    if (snapshot || !have_sequence_) {
      have_sequence_ = true;
    } else if (sequence != expected_) {
      ++gaps_;
    }
    expected_ = sequence + 1;
  }

  void record_latency_ns(std::uint64_t ns) noexcept {
    samples_[next_ % samples_.size()] = ns;
    ++next_;
  }

  std::uint64_t latency_percentile_ns(double p) const {
    const std::size_t n = std::min<std::size_t>(next_, samples_.size());
    if (n == 0) return 0;
    std::vector<std::uint64_t> copy(samples_.begin(), samples_.begin() + static_cast<std::ptrdiff_t>(n));
    const auto k = static_cast<std::size_t>(p * static_cast<double>(n - 1));
    std::nth_element(copy.begin(), copy.begin() + static_cast<std::ptrdiff_t>(k), copy.end());
    return copy[k];
  }

  std::uint64_t gaps() const noexcept { return gaps_; }

 private:
  bool have_sequence_{false};
  std::uint64_t expected_{0};
  std::uint64_t gaps_{0};
  std::size_t next_{0};
  std::array<std::uint64_t, 4096> samples_{};
};

}  // namespace live
