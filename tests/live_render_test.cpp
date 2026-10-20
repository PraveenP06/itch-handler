#include <doctest/doctest.h>

#include <string>

#include "live/render.hpp"

TEST_CASE("prices are printed with at least two decimals and no trailing zeros beyond that") {
  CHECK(live::format_price(8156628000000LL) == "81566.28");
  CHECK(live::format_price(7137050000000LL) == "71370.50");
  CHECK(live::format_price(1LL) == "0.00000001");
  CHECK(live::format_price(500000000LL) == "5.00");
}

TEST_CASE("the book json contains best levels, stats and the age of the last message") {
  live::BookView view;
  view.bids = {{8156628000000LL, 1.5}, {8156600000000LL, 2.0}};
  view.asks = {{8156640000000LL, 0.25}};
  view.messages = 1234;
  view.gaps = 2;
  view.p50_ns = 900;
  view.p99_ns = 4000;
  const std::string json = live::render_json(view, 150);
  CHECK(json.find(R"("bids":[["81566.28",1.5],["81566.00",2]])") != std::string::npos);
  CHECK(json.find(R"("asks":[["81566.40",0.25]])") != std::string::npos);
  CHECK(json.find(R"("messages":1234)") != std::string::npos);
  CHECK(json.find(R"("gaps":2)") != std::string::npos);
  CHECK(json.find(R"("p50_ns":900)") != std::string::npos);
  CHECK(json.find(R"("age_ms":150)") != std::string::npos);
}

TEST_CASE("an empty book renders empty arrays") {
  const std::string json = live::render_json(live::BookView{}, 0);
  CHECK(json.find(R"("bids":[])") != std::string::npos);
  CHECK(json.find(R"("asks":[])") != std::string::npos);
}
