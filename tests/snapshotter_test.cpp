#include <doctest/doctest.h>

#include "itch/snapshotter.hpp"

namespace {

using itch::Event;
using itch::EventType;
using itch::Side;

Event add(std::uint64_t ts_s, std::uint64_t ref, Side side, std::uint32_t shares, std::uint32_t price, std::uint16_t locate = 1) {
  Event e;
  e.type = EventType::Add;
  e.timestamp_ns = ts_s * 1'000'000'000ULL;
  e.ref = ref;
  e.side = side;
  e.shares = shares;
  e.price = price;
  e.locate = locate;
  return e;
}

constexpr std::uint64_t kSecond = 1'000'000'000ULL;

}  // namespace

TEST_CASE("a snapshot shows the book as it stood at each interval boundary") {
  itch::OrderBook book({.order_capacity = 64, .locates = 4});
  itch::Snapshotter snaps(book, 1, 10 * kSecond);
  for (const auto& e : {add(1, 1, Side::Buy, 100, 1000), add(5, 2, Side::Sell, 50, 1010), add(11, 3, Side::Buy, 70, 1001), add(31, 4, Side::Buy, 5, 999)}) {
    snaps.observe(e);
    book.apply(e);
  }
  const auto& out = snaps.snapshots();
  REQUIRE(out.size() == 3);
  CHECK(out[0].time_ns == 10 * kSecond);
  CHECK(out[0].bids[0].price == 1000);
  CHECK(out[0].asks[0].price == 1010);
  CHECK(out[1].time_ns == 20 * kSecond);
  CHECK(out[1].bids[0].price == 1001);
  CHECK(out[2].time_ns == 30 * kSecond);
}

TEST_CASE("a snapshot lists the best levels first and caps the depth") {
  itch::OrderBook book({.order_capacity = 64, .locates = 4});
  itch::Snapshotter snaps(book, 1, 1 * kSecond);
  const auto standing_ask = add(1, 99, Side::Sell, 10, 5000);
  snaps.observe(standing_ask);
  book.apply(standing_ask);
  for (std::uint32_t i = 0; i < 15; ++i) {
    const auto e = add(1, 100 + i, Side::Buy, 10, 1000 + i);
    snaps.observe(e);
    book.apply(e);
  }
  snaps.observe(add(2, 500, Side::Sell, 1, 6000));
  REQUIRE_FALSE(snaps.snapshots().empty());
  const auto& s = snaps.snapshots().front();
  CHECK(s.bid_count == itch::Snapshotter::kDepth);
  CHECK(s.bids[0].price == 1014);
  CHECK(s.bids[1].price == 1013);
  CHECK(s.ask_count == 1);
}

TEST_CASE("activity counts messages per minute of the market clock") {
  itch::OrderBook book({.order_capacity = 64, .locates = 4});
  itch::Snapshotter snaps(book, 1, 10 * kSecond);
  for (const auto& e : {add(5, 1, Side::Buy, 1, 100), add(30, 2, Side::Buy, 1, 100), add(65, 3, Side::Buy, 1, 100)}) {
    snaps.observe(e);
    book.apply(e);
  }
  CHECK(snaps.messages_per_minute().at(0) == 2);
  CHECK(snaps.messages_per_minute().at(1) == 1);
}
