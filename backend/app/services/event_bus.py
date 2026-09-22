import queue as pyqueue
from collections import defaultdict

_subscribers: dict[str, list] = defaultdict(list)


def subscribe(investigation_id: str):
    q = pyqueue.Queue()
    _subscribers[investigation_id].append(q)
    return q


def unsubscribe(investigation_id: str, q):
    if q in _subscribers[investigation_id]:
        _subscribers[investigation_id].remove(q)


def publish(investigation_id: str, event: dict):
    for q in _subscribers.get(investigation_id, []):
        q.put(event)