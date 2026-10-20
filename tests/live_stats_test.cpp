#include <doctest/doctest.h>

#include "live/live_stats.hpp"

TEST_CASE("a consecutive sequence is not a gap but a jump is") {
  live::LiveStats s;
  s.on_sequence(10, false);
  s.on_sequence(11, false);
  CHECK(s.gaps() == 0);
  s.on_sequence(15, false);
  CHECK(s.gaps() == 1);
}

TEST_CASE("a snapshot resets the expected sequence without counting a gap") {
  live::LiveStats s;
  s.on_sequence(10, false);
  s.on_sequence(500, true);
  s.on_sequence(501, false);
  CHECK(s.gaps() == 0);
}

TEST_CASE("latency percentiles come from recent samples") {
  live::LiveStats s;
  for (int i = 1; i <= 100; ++i) s.record_latency_ns(static_cast<std::uint64_t>(i));
  CHECK(s.latency_percentile_ns(0.5) == 50);
  CHECK(s.latency_percentile_ns(0.99) == 99);
  CHECK(live::LiveStats().latency_percentile_ns(0.5) == 0);
}
