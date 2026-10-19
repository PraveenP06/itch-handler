#pragma once

#include <cstddef>
#include <cstdint>
#include <cstring>

namespace itch {

enum class EventType : std::uint8_t { Ignored, Malformed, System, Directory, Add, Execute, Cancel, Delete, Replace };

enum class Side : std::uint8_t { Buy, Sell };

struct Event {
  EventType type{EventType::Ignored};
  Side side{Side::Buy};
  std::uint16_t locate{0};
  std::uint32_t shares{0};
  std::uint32_t price{0};
  std::uint64_t timestamp_ns{0};
  std::uint64_t ref{0};
  std::uint64_t new_ref{0};
  char stock[8]{};
};

namespace detail {

template <typename T>
inline T load_be(const std::byte* p) noexcept {
  T v;
  std::memcpy(&v, p, sizeof v);
  if constexpr (sizeof(T) == 2) return __builtin_bswap16(v);
  else if constexpr (sizeof(T) == 4) return __builtin_bswap32(v);
  else return __builtin_bswap64(v);
}

inline std::uint64_t load_be48(const std::byte* p) noexcept {
  std::uint64_t v = 0;
  for (int i = 0; i < 6; ++i) v = (v << 8) | static_cast<std::uint8_t>(p[i]);
  return v;
}

inline std::size_t expected_length(char type) noexcept {
  switch (type) {
    case 'S': return 12;
    case 'R': return 39;
    case 'H': return 25;
    case 'A': return 36;
    case 'F': return 40;
    case 'E': return 31;
    case 'C': return 36;
    case 'X': return 23;
    case 'D': return 19;
    case 'U': return 35;
    default: return 0;
  }
}

}  // namespace detail

inline Event parse(const std::byte* data, std::size_t length) noexcept {
  using namespace detail;
  Event e;
  if (length == 0) {
    e.type = EventType::Malformed;
    return e;
  }
  const char type = static_cast<char>(data[0]);
  const std::size_t expected = expected_length(type);
  if (expected == 0) return e;
  if (length != expected) {
    e.type = EventType::Malformed;
    return e;
  }
  e.locate = load_be<std::uint16_t>(data + 1);
  e.timestamp_ns = load_be48(data + 5);
  switch (type) {
    case 'S':
      e.type = EventType::System;
      break;
    case 'R':
      e.type = EventType::Directory;
      std::memcpy(e.stock, data + 11, 8);
      break;
    case 'A':
    case 'F':
      e.type = EventType::Add;
      e.ref = load_be<std::uint64_t>(data + 11);
      e.side = static_cast<char>(data[19]) == 'B' ? Side::Buy : Side::Sell;
      e.shares = load_be<std::uint32_t>(data + 20);
      std::memcpy(e.stock, data + 24, 8);
      e.price = load_be<std::uint32_t>(data + 32);
      break;
    case 'E':
    case 'C':
      e.type = EventType::Execute;
      e.ref = load_be<std::uint64_t>(data + 11);
      e.shares = load_be<std::uint32_t>(data + 19);
      break;
    case 'X':
      e.type = EventType::Cancel;
      e.ref = load_be<std::uint64_t>(data + 11);
      e.shares = load_be<std::uint32_t>(data + 19);
      break;
    case 'D':
      e.type = EventType::Delete;
      e.ref = load_be<std::uint64_t>(data + 11);
      break;
    case 'U':
      e.type = EventType::Replace;
      e.ref = load_be<std::uint64_t>(data + 11);
      e.new_ref = load_be<std::uint64_t>(data + 19);
      e.shares = load_be<std::uint32_t>(data + 27);
      e.price = load_be<std::uint32_t>(data + 31);
      break;
    default:
      break;
  }
  return e;
}

}  // namespace itch
