#include <doctest/doctest.h>

#include <cstdint>
#include <thread>

#include "itch/spsc_ring.hpp"

TEST_CASE("ring starts empty and returns items in order") {
  itch::SpscRing<int, 4> ring;
  int out = 0;
  CHECK_FALSE(ring.try_pop(out));
  CHECK(ring.try_push(1));
  CHECK(ring.try_push(2));
  CHECK(ring.try_pop(out));
  CHECK(out == 1);
  CHECK(ring.try_pop(out));
  CHECK(out == 2);
  CHECK_FALSE(ring.try_pop(out));
}

TEST_CASE("ring refuses a push when full and accepts again after a pop") {
  itch::SpscRing<int, 4> ring;
  for (int i = 0; i < 4; ++i) CHECK(ring.try_push(i));
  CHECK_FALSE(ring.try_push(99));
  int out = 0;
  CHECK(ring.try_pop(out));
  CHECK(out == 0);
  CHECK(ring.try_push(99));
}

TEST_CASE("ring wraps around its storage many times") {
  itch::SpscRing<std::uint64_t, 8> ring;
  std::uint64_t out = 0;
  for (std::uint64_t i = 0; i < 1000; ++i) {
    CHECK(ring.try_push(i));
    CHECK(ring.try_pop(out));
    CHECK(out == i);
  }
}

TEST_CASE("one producer and one consumer thread transfer every item in order") {
  constexpr std::uint64_t kCount = 2'000'000;
  itch::SpscRing<std::uint64_t, 1024> ring;
  std::thread producer([&] {
    for (std::uint64_t i = 0; i < kCount; ++i)
      while (!ring.try_push(i)) {}
  });
  std::uint64_t expected = 0;
  bool in_order = true;
  while (expected < kCount) {
    std::uint64_t v = 0;
    if (!ring.try_pop(v)) continue;
    if (v != expected) in_order = false;
    ++expected;
  }
  producer.join();
  CHECK(in_order);
}
