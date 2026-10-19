#pragma once

#include <cstddef>
#include <cstdint>

namespace itch {

template <typename OnMessage>
inline std::size_t consume_frames(const std::byte* data, std::size_t length, OnMessage&& on_message) {
  std::size_t offset = 0;
  while (length - offset >= 2) {
    const std::size_t size = (static_cast<std::size_t>(data[offset]) << 8) | static_cast<std::size_t>(data[offset + 1]);
    if (length - offset - 2 < size) break;
    on_message(data + offset + 2, size);
    offset += 2 + size;
  }
  return offset;
}

}  // namespace itch
