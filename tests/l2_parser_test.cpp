#include <doctest/doctest.h>

#include <string>
#include <vector>

#include "live/l2_parser.hpp"

namespace {

struct Seen {
  live::BookSide side;
  std::int64_t price;
  double qty;
};

std::vector<Seen> collect(const std::string& line, live::L2Header& header) {
  std::vector<Seen> out;
  header = live::parse_l2(line, [&](live::BookSide s, std::int64_t p, double q) { out.push_back({s, p, q}); });
  return out;
}

const std::string kUpdate =
    R"({"channel":"l2_data","timestamp":"2026-10-15T00:00:00.010633012Z","sequence_num":21642,"events":[{"type":"update","product_id":"BTC-USD","updates":[)"
    R"({"side":"bid","event_time":"2026-10-14T23:59:59.991557Z","price_level":"71370.5","new_quantity":"0.01035795"},)"
    R"({"side":"offer","event_time":"2026-10-14T23:59:59.991557Z","price_level":"82141.3","new_quantity":"0"}]}]})";

}  // namespace

TEST_CASE("an update message yields its sequence and each price level change in order") {
  live::L2Header h;
  const auto seen = collect(kUpdate, h);
  CHECK(h.valid);
  CHECK_FALSE(h.snapshot);
  CHECK(h.sequence == 21642);
  REQUIRE(seen.size() == 2);
  CHECK(seen[0].side == live::BookSide::Bid);
  CHECK(seen[0].price == 7137050000000LL);
  CHECK(seen[0].qty == doctest::Approx(0.01035795));
  CHECK(seen[1].side == live::BookSide::Ask);
  CHECK(seen[1].price == 8214130000000LL);
  CHECK(seen[1].qty == 0.0);
}

TEST_CASE("a snapshot event is flagged so the book can be reset first") {
  const std::string snap =
      R"({"channel":"l2_data","timestamp":"t","sequence_num":5,"events":[{"type":"snapshot","product_id":"BTC-USD","updates":[)"
      R"({"side":"bid","event_time":"e","price_level":"100.25","new_quantity":"2"}]}]})";
  live::L2Header h;
  const auto seen = collect(snap, h);
  CHECK(h.valid);
  CHECK(h.snapshot);
  REQUIRE(seen.size() == 1);
  CHECK(seen[0].price == 10025000000LL);
}

TEST_CASE("messages from other channels are not book data") {
  live::L2Header h;
  const auto seen = collect(R"({"channel":"heartbeats","timestamp":"t","sequence_num":3,"events":[{"current_time":"x","heartbeat_counter":9}]})", h);
  CHECK_FALSE(h.valid);
  CHECK(seen.empty());
  collect(R"({"channel":"subscriptions","events":[]})", h);
  CHECK_FALSE(h.valid);
}

TEST_CASE("truncated or garbage input never crashes and is not valid") {
  live::L2Header h;
  collect("", h);
  CHECK_FALSE(h.valid);
  collect("not json at all", h);
  CHECK_FALSE(h.valid);
  const auto partial = collect(kUpdate.substr(0, kUpdate.size() / 2), h);
  CHECK(partial.size() <= 1);
  for (const auto& u : partial) CHECK(u.price > 0);
}

TEST_CASE("decimal prices keep eight fractional digits exactly") {
  CHECK(live::parse_price("81566.28") == 8156628000000LL);
  CHECK(live::parse_price("0.00000001") == 1LL);
  CHECK(live::parse_price("5") == 500000000LL);
  CHECK(live::parse_price("") == -1);
}

TEST_CASE("the header can be read without applying any updates") {
  const auto h = live::parse_l2_header(kUpdate);
  CHECK(h.valid);
  CHECK(h.sequence == 21642);
  CHECK_FALSE(h.snapshot);
  CHECK_FALSE(live::parse_l2_header(R"({"channel":"subscriptions"})").valid);
}

TEST_CASE("the sequence number is read from any channel, because all channels share one counter") {
  CHECK(live::parse_sequence(R"({"channel":"heartbeats","timestamp":"t","sequence_num":284468,"events":[]})") == 284468);
  CHECK(live::parse_sequence(kUpdate) == 21642);
  CHECK_FALSE(live::parse_sequence(R"({"channel":"subscriptions","events":[]})").has_value());
  CHECK_FALSE(live::parse_sequence("").has_value());
}
