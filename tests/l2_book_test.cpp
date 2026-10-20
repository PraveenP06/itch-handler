#include <doctest/doctest.h>

#include "live/l2_book.hpp"

using live::BookSide;

TEST_CASE("a level is set, replaced and removed by quantity") {
  live::L2Book book;
  book.set(BookSide::Bid, 100, 2.0);
  book.set(BookSide::Bid, 100, 3.0);
  CHECK(book.best_bid()->qty == 3.0);
  book.set(BookSide::Bid, 100, 0.0);
  CHECK_FALSE(book.best_bid().has_value());
}

TEST_CASE("best bid is the highest bid and best ask the lowest ask") {
  live::L2Book book;
  book.set(BookSide::Bid, 100, 1.0);
  book.set(BookSide::Bid, 105, 1.0);
  book.set(BookSide::Ask, 110, 1.0);
  book.set(BookSide::Ask, 108, 1.0);
  CHECK(book.best_bid()->price == 105);
  CHECK(book.best_ask()->price == 108);
}

TEST_CASE("depth lists the best levels first") {
  live::L2Book book;
  for (std::int64_t p = 1; p <= 5; ++p) book.set(BookSide::Bid, p * 10, static_cast<double>(p));
  const auto levels = book.depth(BookSide::Bid, 3);
  REQUIRE(levels.size() == 3);
  CHECK(levels[0].price == 50);
  CHECK(levels[2].price == 30);
}

TEST_CASE("clear empties both sides for a fresh snapshot") {
  live::L2Book book;
  book.set(BookSide::Bid, 1, 1.0);
  book.set(BookSide::Ask, 2, 1.0);
  book.clear();
  CHECK_FALSE(book.best_bid().has_value());
  CHECK_FALSE(book.best_ask().has_value());
  CHECK(book.level_count() == 0);
}

TEST_CASE("a crossed book is detected") {
  live::L2Book book;
  book.set(BookSide::Bid, 100, 1.0);
  book.set(BookSide::Ask, 101, 1.0);
  CHECK_FALSE(book.crossed());
  book.set(BookSide::Ask, 99, 1.0);
  CHECK(book.crossed());
}
