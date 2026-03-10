from queue import Empty, Queue
from typing import Dict, Generator, Optional


class MicrophoneStream:
    def __init__(self, sample_rate: int = 16000, chunk_size: int = 1024):
        self.sample_rate = sample_rate
        self.chunk_size = chunk_size
        self._queue = Queue()

    def push_chunk(self, chunk: bytes, metadata: Optional[Dict[str, str]] = None) -> None:
        self._queue.put({"audio": chunk, "metadata": metadata or {}})

    def listen_stream(self, max_chunks: int = 32) -> Generator[Dict[str, object], None, None]:
        emitted = 0
        while emitted < max_chunks:
            try:
                item = self._queue.get(timeout=0.05)
            except Empty:
                break
            emitted += 1
            yield item

    def status(self) -> Dict[str, int]:
        return {
            "sample_rate": self.sample_rate,
            "chunk_size": self.chunk_size,
            "queued_chunks": self._queue.qsize(),
        }
