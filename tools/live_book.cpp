#include <arpa/inet.h>
#include <netinet/in.h>
#include <signal.h>
#include <sys/socket.h>
#include <unistd.h>

#include <atomic>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <mutex>
#include <string>
#include <thread>

#include "live/l2_book.hpp"
#include "live/live_stats.hpp"
#include "live/page.hpp"
#include "live/render.hpp"

namespace {

using Clock = std::chrono::steady_clock;

struct Shared {
  std::mutex mutex;
  live::BookView view;
  Clock::time_point last_message{Clock::now()};
};

void send_all(int fd, const std::string& data) {
  std::size_t sent = 0;
  while (sent < data.size()) {
    const ssize_t n = ::send(fd, data.data() + sent, data.size() - sent, 0);
    if (n <= 0) return;
    sent += static_cast<std::size_t>(n);
  }
}

std::string response(const char* status, const char* type, const std::string& body) {
  return std::string("HTTP/1.1 ") + status + "\r\nContent-Type: " + type + "\r\nContent-Length: " + std::to_string(body.size()) +
         "\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n" + body;
}

void serve(int listener, Shared& shared) {
  for (;;) {
    const int fd = ::accept(listener, nullptr, nullptr);
    if (fd < 0) continue;
    timeval tv{2, 0};
    ::setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof tv);
    char buf[2048];
    const ssize_t n = ::recv(fd, buf, sizeof buf - 1, 0);
    if (n > 0) {
      buf[n] = '\0';
      const std::string request(buf);
      if (request.rfind("GET /book ", 0) == 0) {
        std::string json;
        {
          std::lock_guard<std::mutex> lock(shared.mutex);
          const auto age = std::chrono::duration_cast<std::chrono::milliseconds>(Clock::now() - shared.last_message).count();
          json = live::render_json(shared.view, static_cast<std::uint64_t>(age));
        }
        send_all(fd, response("200 OK", "application/json", json));
      } else if (request.rfind("GET / ", 0) == 0) {
        send_all(fd, response("200 OK", "text/html; charset=utf-8", live::kPage));
      } else if (request.rfind("GET /healthz ", 0) == 0) {
        send_all(fd, response("200 OK", "text/plain", "ok"));
      } else {
        send_all(fd, response("404 Not Found", "text/plain", "not found"));
      }
    }
    ::close(fd);
  }
}

int listen_on(const char* address, int port) {
  const int fd = ::socket(AF_INET, SOCK_STREAM, 0);
  const int yes = 1;
  ::setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof yes);
  sockaddr_in addr{};
  addr.sin_family = AF_INET;
  addr.sin_port = htons(static_cast<std::uint16_t>(port));
  if (::inet_pton(AF_INET, address, &addr.sin_addr) != 1) return -1;
  if (::bind(fd, reinterpret_cast<sockaddr*>(&addr), sizeof addr) != 0) return -1;
  if (::listen(fd, 16) != 0) return -1;
  return fd;
}

}  // namespace

int main(int argc, char** argv) {
  std::string address = "127.0.0.1";
  int port = 8080;
  std::size_t depth = 15;
  bool dump_final = false;
  for (int i = 1; i < argc; ++i) {
    const std::string a = argv[i];
    if (a == "--port" && i + 1 < argc) port = std::atoi(argv[++i]);
    else if (a == "--bind" && i + 1 < argc) address = argv[++i];
    else if (a == "--dump-final") dump_final = true;
    else if (a == "--depth" && i + 1 < argc) depth = static_cast<std::size_t>(std::atoi(argv[++i]));
    else { std::fprintf(stderr, "usage: live_book [--port N] [--bind ADDR] [--depth N]  < raw l2 messages, one per line\n"); return 2; }
  }
  ::signal(SIGPIPE, SIG_IGN);
  Shared shared;
  if (!dump_final) {
    const int listener = listen_on(address.c_str(), port);
    if (listener < 0) { std::fprintf(stderr, "cannot listen on %s:%d\n", address.c_str(), port); return 1; }
    std::fprintf(stderr, "live_book serving http://%s:%d\n", address.c_str(), port);
    std::thread server(serve, listener, std::ref(shared));
    server.detach();
  }

  live::L2Book book;
  live::LiveStats stats;
  std::uint64_t messages = 0, updates = 0, snapshots = 0, crossed = 0, last_sequence = 0;
  const auto started = Clock::now();
  auto last_publish = started;
  auto rate_time = started;
  std::uint64_t rate_count = 0;
  double rate = 0.0;

  std::ios::sync_with_stdio(false);
  std::string line;
  while (std::getline(std::cin, line)) {
    const auto t0 = Clock::now();
    const live::L2Header header = live::parse_l2_header(line);
    if (!header.valid) {
      if (const auto seq = live::parse_sequence(line)) stats.on_sequence(*seq, false);
      continue;
    }
    if (header.snapshot) { book.clear(); ++snapshots; }
    live::parse_l2(line, [&](live::BookSide side, std::int64_t price, double qty) {
      book.set(side, price, qty);
      ++updates;
    });
    stats.on_sequence(header.sequence, header.snapshot);
    last_sequence = header.sequence;
    if (book.crossed()) ++crossed;
    ++messages;
    const auto t1 = Clock::now();
    stats.record_latency_ns(static_cast<std::uint64_t>(std::chrono::duration_cast<std::chrono::nanoseconds>(t1 - t0).count()));

    if (t1 - rate_time >= std::chrono::seconds(1)) {
      rate = static_cast<double>(messages - rate_count) / std::chrono::duration<double>(t1 - rate_time).count();
      rate_count = messages;
      rate_time = t1;
    }
    if (t1 - last_publish >= std::chrono::milliseconds(100)) {
      live::BookView view;
      view.bids = book.depth(live::BookSide::Bid, depth);
      view.asks = book.depth(live::BookSide::Ask, depth);
      view.messages = messages; view.updates = updates; view.snapshots = snapshots; view.gaps = stats.gaps();
      view.crossed_events = crossed; view.last_sequence = last_sequence; view.levels = book.level_count();
      view.p50_ns = stats.latency_percentile_ns(0.5); view.p99_ns = stats.latency_percentile_ns(0.99);
      view.msgs_per_sec = rate; view.uptime_s = std::chrono::duration<double>(t1 - started).count();
      {
        std::lock_guard<std::mutex> lock(shared.mutex);
        shared.view = std::move(view);
        shared.last_message = t1;
      }
      last_publish = t1;
    }
  }
  if (dump_final) {
    live::BookView view;
    view.bids = book.depth(live::BookSide::Bid, depth);
    view.asks = book.depth(live::BookSide::Ask, depth);
    view.messages = messages; view.updates = updates; view.snapshots = snapshots; view.gaps = stats.gaps();
    view.crossed_events = crossed; view.last_sequence = last_sequence; view.levels = book.level_count();
    view.p50_ns = stats.latency_percentile_ns(0.5); view.p99_ns = stats.latency_percentile_ns(0.99);
    std::puts(live::render_json(view, 0).c_str());
    return 0;
  }
  std::fprintf(stderr, "input closed after %llu messages\n", static_cast<unsigned long long>(messages));
  return 1;
}
