import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request


class RateLimiter:
    """In-memory sliding window per client IP. Fine for a single-process deployment."""

    def __init__(self, limit: int, window: float = 60.0):
        self.limit, self.window = limit, window
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    def __call__(self, request: Request) -> None:
        ip = request.client.host if request.client else "unknown"
        now, q = time.monotonic(), self.hits[ip]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            raise HTTPException(429, "Too many analysis requests; please wait a minute")
        q.append(now)


analyze_limiter = RateLimiter(limit=20)
