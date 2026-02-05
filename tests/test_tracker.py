import unittest

from zachary_tracker.main import parse_args
from zachary_tracker.providers.base import Provider


class DummyProvider(Provider):
    name = "dummy"

    def fetch_update(self, item):
        raise NotImplementedError


class TrackerTests(unittest.TestCase):
    def test_parse_add(self):
        args = parse_args(["add", "amazon", "ABC", "Desk"])
        self.assertEqual(args.cmd, "add")
        self.assertEqual(args.provider, "amazon")

    def test_status_flow(self):
        p = DummyProvider()
        self.assertEqual(p.next_status("ordered"), "shipped")
        self.assertEqual(p.next_status("delivered"), "delivered")


if __name__ == "__main__":
    unittest.main()
