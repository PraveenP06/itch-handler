#include <doctest/doctest.h>

#include <cstdint>
#include <map>
#include <random>
#include <unordered_map>
#include <vector>

#include "itch/order_book.hpp"

namespace {

using itch::Event;
using itch::EventType;
using itch::Side;

Event add(std::uint64_t ref, Side side, std::uint32_t shares, std::uint32_t price, std::uint16_t locate = 1) {
  Event e;
  e.type = EventType::Add;
  e.ref = ref;
  e.side = side;
  e.shares = shares;
  e.price = price;
  e.locate = locate;
  return e;
}
Event execute(std::uint64_t ref, std::uint32_t shares) {
  Event e; e.type = EventType::Execute; e.ref = ref; e.shares = shares; return e;
}
Event cancel(std::uint64_t ref, std::uint32_t shares) {
  Event e; e.type = EventType::Cancel; e.ref = ref; e.shares = shares; return e;
}
Event del(std::uint64_t ref) {
  Event e; e.type = EventType::Delete; e.ref = ref; return e;
}
Event replace(std::uint64_t ref, std::uint64_t new_ref, std::uint32_t shares, std::uint32_t price) {
  Event e; e.type = EventType::Replace; e.ref = ref; e.new_ref = new_ref; e.shares = shares; e.price = price; return e;
}

itch::OrderBook make_book() { return itch::OrderBook({.order_capacity = 1 << 10, .locates = 8}); }

}  // namespace

TEST_CASE("an empty book has no best prices") {
  auto book = make_book();
  CHECK_FALSE(book.best_bid(1).has_value());
  CHECK_FALSE(book.best_ask(1).has_value());
}

TEST_CASE("adds aggregate shares and order counts at a price level") {
  auto book = make_book();
  CHECK(book.apply(add(1, Side::Buy, 100, 1000)) == itch::Result::Ok);
  CHECK(book.apply(add(2, Side::Buy, 50, 1000)) == itch::Result::Ok);
  CHECK(book.apply(add(3, Side::Buy, 70, 990)) == itch::Result::Ok);
  const auto bid = book.best_bid(1);
  REQUIRE(bid.has_value());
  CHECK(bid->price == 1000);
  CHECK(bid->shares == 150);
  CHECK(bid->orders == 2);
  CHECK(book.live_orders() == 3);
}

TEST_CASE("best ask is the lowest sell price") {
  auto book = make_book();
  book.apply(add(1, Side::Sell, 10, 1010));
  book.apply(add(2, Side::Sell, 20, 1005));
  book.apply(add(3, Side::Sell, 30, 1020));
  CHECK(book.best_ask(1)->price == 1005);
}

TEST_CASE("books for different stocks are independent") {
  auto book = make_book();
  book.apply(add(1, Side::Buy, 100, 1000, 1));
  book.apply(add(2, Side::Buy, 100, 2000, 2));
  CHECK(book.best_bid(1)->price == 1000);
  CHECK(book.best_bid(2)->price == 2000);
}

TEST_CASE("a partial execute leaves the remainder resting") {
  auto book = make_book();
  book.apply(add(1, Side::Buy, 100, 1000));
  CHECK(book.apply(execute(1, 40)) == itch::Result::Ok);
  CHECK(book.best_bid(1)->shares == 60);
  CHECK(book.live_orders() == 1);
}

TEST_CASE("a full execute removes the order and empties the level") {
  auto book = make_book();
  book.apply(add(1, Side::Buy, 100, 1000));
  book.apply(execute(1, 100));
  CHECK_FALSE(book.best_bid(1).has_value());
  CHECK(book.live_orders() == 0);
}

TEST_CASE("partial cancel reduces and delete removes") {
  auto book = make_book();
  book.apply(add(1, Side::Sell, 100, 1000));
  book.apply(cancel(1, 30));
  CHECK(book.best_ask(1)->shares == 70);
  book.apply(del(1));
  CHECK_FALSE(book.best_ask(1).has_value());
}

TEST_CASE("replace moves the order to a new price with a new reference") {
  auto book = make_book();
  book.apply(add(1, Side::Buy, 100, 1000));
  CHECK(book.apply(replace(1, 2, 80, 1010)) == itch::Result::Ok);
  CHECK(book.best_bid(1)->price == 1010);
  CHECK(book.best_bid(1)->shares == 80);
  CHECK(book.apply(del(1)) == itch::Result::UnknownOrder);
  CHECK(book.apply(del(2)) == itch::Result::Ok);
}

TEST_CASE("unknown references and duplicates are reported and change nothing") {
  auto book = make_book();
  CHECK(book.apply(execute(9, 1)) == itch::Result::UnknownOrder);
  CHECK(book.apply(cancel(9, 1)) == itch::Result::UnknownOrder);
  CHECK(book.apply(del(9)) == itch::Result::UnknownOrder);
  book.apply(add(1, Side::Buy, 10, 100));
  CHECK(book.apply(add(1, Side::Buy, 10, 100)) == itch::Result::DuplicateOrder);
  CHECK(book.best_bid(1)->shares == 10);
}

TEST_CASE("executing or cancelling more than rests is rejected") {
  auto book = make_book();
  book.apply(add(1, Side::Buy, 10, 100));
  CHECK(book.apply(execute(1, 11)) == itch::Result::Oversize);
  CHECK(book.apply(cancel(1, 11)) == itch::Result::Oversize);
  CHECK(book.best_bid(1)->shares == 10);
}

TEST_CASE("depth returns levels from the top of the book") {
  auto book = make_book();
  book.apply(add(1, Side::Buy, 10, 100));
  book.apply(add(2, Side::Buy, 20, 101));
  book.apply(add(3, Side::Buy, 30, 99));
  itch::Level out[2];
  const auto n = book.depth(1, Side::Buy, out, 2);
  CHECK(n == 2);
  CHECK(out[0].price == 101);
  CHECK(out[1].price == 100);
}

TEST_CASE("the order table survives many collisions and deletions") {
  auto book = itch::OrderBook({.order_capacity = 64, .locates = 2});
  for (std::uint64_t i = 1; i <= 40; ++i) CHECK(book.apply(add(i * 64, Side::Buy, 1, 100)) == itch::Result::Ok);
  for (std::uint64_t i = 1; i <= 40; i += 2) CHECK(book.apply(del(i * 64)) == itch::Result::Ok);
  for (std::uint64_t i = 2; i <= 40; i += 2) CHECK(book.apply(del(i * 64)) == itch::Result::Ok);
  CHECK(book.live_orders() == 0);
}

TEST_CASE("a full order table reports instead of failing") {
  auto book = itch::OrderBook({.order_capacity = 8, .locates = 2});
  itch::Result last = itch::Result::Ok;
  for (std::uint64_t i = 1; i <= 8; ++i) last = book.apply(add(i, Side::Buy, 1, 100));
  CHECK(last == itch::Result::TableFull);
}

namespace {

struct ReferenceBook {
  struct Order { std::uint16_t locate; Side side; std::uint32_t price; std::uint32_t shares; };
  std::unordered_map<std::uint64_t, Order> orders;
  std::map<std::pair<std::uint16_t, Side>, std::map<std::uint32_t, std::uint64_t>> levels;

  void add_to(const Order& o) { levels[{o.locate, o.side}][o.price] += o.shares; }
  void take_from(const Order& o, std::uint32_t shares) {
    auto& side = levels[{o.locate, o.side}];
    auto it = side.find(o.price);
    it->second -= shares;
    if (it->second == 0) side.erase(it);
  }
};

}  // namespace

TEST_CASE("randomised streams match a simple reference book at every step") {
  std::mt19937_64 rng(12345);
  auto book = itch::OrderBook({.order_capacity = 1 << 16, .locates = 4});
  ReferenceBook ref;
  std::vector<std::uint64_t> live;
  std::uint64_t next_ref = 1;
  auto pick = [&](std::uint64_t n) { return rng() % n; };

  for (int step = 0; step < 20000; ++step) {
    const auto roll = pick(100);
    if (live.empty() || roll < 40) {
      const ReferenceBook::Order o{static_cast<std::uint16_t>(1 + pick(3)), pick(2) ? Side::Buy : Side::Sell,
                                   static_cast<std::uint32_t>(990 + pick(21)), static_cast<std::uint32_t>(1 + pick(500))};
      const auto id = next_ref++;
      REQUIRE(book.apply(add(id, o.side, o.shares, o.price, o.locate)) == itch::Result::Ok);
      ref.orders[id] = o; ref.add_to(o); live.push_back(id);
    } else {
      const auto idx = pick(live.size());
      const auto id = live[idx];
      auto& o = ref.orders[id];
      if (roll < 60) {
        const auto q = static_cast<std::uint32_t>(1 + pick(o.shares));
        REQUIRE(book.apply(execute(id, q)) == itch::Result::Ok);
        ref.take_from(o, q); o.shares -= q;
      } else if (roll < 75) {
        const auto q = static_cast<std::uint32_t>(1 + pick(o.shares));
        REQUIRE(book.apply(cancel(id, q)) == itch::Result::Ok);
        ref.take_from(o, q); o.shares -= q;
      } else if (roll < 90) {
        REQUIRE(book.apply(del(id)) == itch::Result::Ok);
        ref.take_from(o, o.shares); o.shares = 0;
      } else {
        const auto old = o;
        const auto id2 = next_ref++;
        const auto price = static_cast<std::uint32_t>(990 + pick(21));
        const auto shares = static_cast<std::uint32_t>(1 + pick(500));
        REQUIRE(book.apply(replace(id, id2, shares, price)) == itch::Result::Ok);
        ref.take_from(old, old.shares); o.shares = 0;
        const ReferenceBook::Order n{old.locate, old.side, price, shares};
        ref.orders[id2] = n; ref.add_to(n); live.push_back(id2);
      }
      if (ref.orders[id].shares == 0) { ref.orders.erase(id); live.erase(live.begin() + static_cast<std::ptrdiff_t>(idx)); }
    }
    for (std::uint16_t loc = 1; loc <= 3; ++loc) {
      for (Side s : {Side::Buy, Side::Sell}) {
        const auto& lv = ref.levels[{loc, s}];
        const auto got = s == Side::Buy ? book.best_bid(loc) : book.best_ask(loc);
        if (lv.empty()) { REQUIRE_FALSE(got.has_value()); continue; }
        const auto& top = s == Side::Buy ? *lv.rbegin() : *lv.begin();
        REQUIRE(got.has_value());
        REQUIRE(got->price == top.first);
        REQUIRE(got->shares == top.second);
      }
    }
  }
  CHECK(book.live_orders() == ref.orders.size());
}

TEST_CASE("a stock directory message prepares a stock and rejects an unknown locate") {
  auto book = make_book();
  Event directory;
  directory.type = EventType::Directory;
  directory.locate = 3;
  CHECK(book.apply(directory) == itch::Result::Ok);
  directory.locate = 500;
  CHECK(book.apply(directory) == itch::Result::BadLocate);
  CHECK(book.apply(add(1, Side::Buy, 10, 100, 3)) == itch::Result::Ok);
  CHECK(book.best_bid(3)->price == 100);
}

TEST_CASE("prefetching an event hint never changes book state") {
  auto book = make_book();
  book.apply(add(1, Side::Buy, 10, 100));
  book.prefetch(add(2, Side::Sell, 5, 101));
  book.prefetch(replace(1, 3, 1, 1));
  CHECK(book.live_orders() == 1);
  CHECK(book.best_bid(1)->shares == 10);
  CHECK_FALSE(book.best_ask(1).has_value());
}
