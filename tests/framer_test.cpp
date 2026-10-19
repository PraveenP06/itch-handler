#include <doctest/doctest.h>

#include <cstdint>
#include <vector>

#include "itch/framer.hpp"

namespace {

void put_frame(std::vector<std::byte>& out, std::initializer_list<std::uint8_t> payload) {
  out.push_back(static_cast<std::byte>(payload.size() >> 8));
  out.push_back(static_cast<std::byte>(payload.size() & 0xFF));
  for (auto b : payload) out.push_back(static_cast<std::byte>(b));
}

}  // namespace

TEST_CASE("framer delivers each length-prefixed message and reports what it consumed") {
  std::vector<std::byte> buf;
  put_frame(buf, {'A', 1, 2});
  put_frame(buf, {'D'});
  std::vector<std::size_t> sizes;
  const auto used = itch::consume_frames(buf.data(), buf.size(), [&](const std::byte*, std::size_t n) { sizes.push_back(n); });
  CHECK(used == buf.size());
  CHECK(sizes == std::vector<std::size_t>{3, 1});
}

TEST_CASE("framer stops before an incomplete trailing frame") {
  std::vector<std::byte> buf;
  put_frame(buf, {'A', 1, 2});
  const auto complete = buf.size();
  put_frame(buf, {'D', 9, 9, 9});
  buf.resize(buf.size() - 2);
  int count = 0;
  const auto used = itch::consume_frames(buf.data(), buf.size(), [&](const std::byte*, std::size_t) { ++count; });
  CHECK(used == complete);
  CHECK(count == 1);
}

TEST_CASE("framer waits when even the length prefix is incomplete") {
  std::vector<std::byte> buf{std::byte{0}};
  CHECK(itch::consume_frames(buf.data(), buf.size(), [](const std::byte*, std::size_t) {}) == 0);
}
