#pragma once

#include <array>
#include <atomic>
#include <bit>
#include <cstddef>

namespace itch {

inline constexpr std::size_t kCacheLine = 128;

template <typename T, std::size_t Capacity>
class SpscRing {
  static_assert(std::has_single_bit(Capacity), "capacity must be a power of two");

 public:
  bool try_push(const T& value) noexcept {
    const std::size_t tail = tail_.load(std::memory_order_relaxed);
    if (tail - cached_head_ == Capacity) {
      cached_head_ = head_.load(std::memory_order_acquire);
      if (tail - cached_head_ == Capacity) return false;
    }
    slots_[tail & kMask] = value;
    tail_.store(tail + 1, std::memory_order_release);
    return true;
  }

  bool try_pop(T& out) noexcept {
    const std::size_t head = head_.load(std::memory_order_relaxed);
    if (head == cached_tail_) {
      cached_tail_ = tail_.load(std::memory_order_acquire);
      if (head == cached_tail_) return false;
    }
    out = slots_[head & kMask];
    head_.store(head + 1, std::memory_order_release);
    return true;
  }

 private:
  static constexpr std::size_t kMask = Capacity - 1;

  alignas(kCacheLine) std::atomic<std::size_t> tail_{0};
  std::size_t cached_head_{0};
  alignas(kCacheLine) std::atomic<std::size_t> head_{0};
  std::size_t cached_tail_{0};
  alignas(kCacheLine) std::array<T, Capacity> slots_{};
};

}  // namespace itch
