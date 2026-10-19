#include <doctest/doctest.h>

#include <cstdint>
#include <cstring>
#include <string_view>
#include <vector>

#include "itch/parser.hpp"

namespace {

class Bytes {
 public:
  Bytes& u8(std::uint8_t v) { data_.push_back(static_cast<std::byte>(v)); return *this; }
  Bytes& be(std::uint64_t v, int width) {
    for (int i = width - 1; i >= 0; --i) u8(static_cast<std::uint8_t>(v >> (8 * i)));
    return *this;
  }
  Bytes& text(std::string_view s, std::size_t width) {
    for (std::size_t i = 0; i < width; ++i) u8(i < s.size() ? static_cast<std::uint8_t>(s[i]) : ' ');
    return *this;
  }
  Bytes& header(char type, std::uint16_t locate, std::uint64_t ts) {
    return u8(static_cast<std::uint8_t>(type)).be(locate, 2).be(0, 2).be(ts, 6);
  }
  const std::byte* data() const { return data_.data(); }
  std::size_t size() const { return data_.size(); }

 private:
  std::vector<std::byte> data_;
};

itch::Event parse(const Bytes& b) { return itch::parse(b.data(), b.size()); }

Bytes add_order(char type = 'A') {
  Bytes b;
  b.header(type, 7, 34'200'000'000'123ULL).be(1001, 8).u8('B').be(500, 4).text("AAPL", 8).be(1'902'500, 4);
  if (type == 'F') b.text("NSDQ", 4);
  return b;
}

}  // namespace

TEST_CASE("add order decodes every field") {
  const auto e = parse(add_order());
  CHECK(e.type == itch::EventType::Add);
  CHECK(e.locate == 7);
  CHECK(e.timestamp_ns == 34'200'000'000'123ULL);
  CHECK(e.ref == 1001);
  CHECK(e.side == itch::Side::Buy);
  CHECK(e.shares == 500);
  CHECK(e.price == 1'902'500);
  CHECK(std::string_view(e.stock, 8) == "AAPL    ");
}

TEST_CASE("add order with attribution is also an add") {
  const auto e = parse(add_order('F'));
  CHECK(e.type == itch::EventType::Add);
  CHECK(e.ref == 1001);
  CHECK(e.price == 1'902'500);
}

TEST_CASE("sell side is decoded") {
  Bytes b;
  b.header('A', 1, 1).be(5, 8).u8('S').be(10, 4).text("MSFT", 8).be(100, 4);
  CHECK(parse(b).side == itch::Side::Sell);
}

TEST_CASE("order executed reduces by executed shares") {
  Bytes b;
  b.header('E', 7, 9).be(1001, 8).be(200, 4).be(55, 8);
  const auto e = parse(b);
  CHECK(e.type == itch::EventType::Execute);
  CHECK(e.ref == 1001);
  CHECK(e.shares == 200);
}

TEST_CASE("order executed with price is an execute at the resting order") {
  Bytes b;
  b.header('C', 7, 9).be(1001, 8).be(150, 4).be(56, 8).u8('Y').be(1'900'000, 4);
  const auto e = parse(b);
  CHECK(e.type == itch::EventType::Execute);
  CHECK(e.ref == 1001);
  CHECK(e.shares == 150);
}

TEST_CASE("partial cancel carries the cancelled shares") {
  Bytes b;
  b.header('X', 7, 9).be(1001, 8).be(75, 4);
  const auto e = parse(b);
  CHECK(e.type == itch::EventType::Cancel);
  CHECK(e.ref == 1001);
  CHECK(e.shares == 75);
}

TEST_CASE("delete carries only the reference") {
  Bytes b;
  b.header('D', 7, 9).be(1001, 8);
  const auto e = parse(b);
  CHECK(e.type == itch::EventType::Delete);
  CHECK(e.ref == 1001);
}

TEST_CASE("replace carries old ref, new ref, shares and price") {
  Bytes b;
  b.header('U', 7, 9).be(1001, 8).be(2002, 8).be(300, 4).be(1'903'000, 4);
  const auto e = parse(b);
  CHECK(e.type == itch::EventType::Replace);
  CHECK(e.ref == 1001);
  CHECK(e.new_ref == 2002);
  CHECK(e.shares == 300);
  CHECK(e.price == 1'903'000);
}

TEST_CASE("stock directory maps a locate code to a symbol") {
  Bytes b;
  b.header('R', 7, 1).text("AAPL", 8).u8('Q').u8('N').be(100, 4).u8('N').text("C", 1).text("P", 2).u8('P').u8('N').u8(' ').u8('1').u8('N').be(0, 4).u8('N');
  const auto e = parse(b);
  CHECK(e.type == itch::EventType::Directory);
  CHECK(e.locate == 7);
  CHECK(std::string_view(e.stock, 8) == "AAPL    ");
}

TEST_CASE("system event is reported") {
  Bytes b;
  b.header('S', 0, 1).u8('O');
  CHECK(parse(b).type == itch::EventType::System);
}

TEST_CASE("messages that do not change the book are ignored") {
  Bytes b;
  b.header('H', 7, 1).text("AAPL", 8).u8('T').u8(' ').text("    ", 4);
  CHECK(parse(b).type == itch::EventType::Ignored);
}

TEST_CASE("wrong length for a known type is malformed") {
  auto b = add_order();
  Bytes shorter;
  shorter.header('A', 7, 1).be(1, 8);
  CHECK(parse(shorter).type == itch::EventType::Malformed);
  CHECK(itch::parse(b.data(), 0).type == itch::EventType::Malformed);
}
