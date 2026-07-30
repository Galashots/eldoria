"""Unit tests for pixellab_client download/extraction guardrails.

Run: python -m unittest discover -s tools/pipeline -p "test_*.py"
No network, no token, no credits: only the pure guard functions are exercised.
"""

import io
import os
import sys
import tempfile
import unittest
import zipfile
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pixellab_client as client


def make_zip(members):
    """members: list of (name, bytes). Returns an open ZipFile over memory."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, data in members:
            zf.writestr(name, data)
    buf.seek(0)
    return zipfile.ZipFile(buf)


class CheckDownloadUrl(unittest.TestCase):
    def test_https_allowed_hosts_pass(self):
        client.check_download_url("https://api.pixellab.ai/v2/thing")
        client.check_download_url("https://f005.backblazeb2.com/file/x.png")

    def test_http_rejected(self):
        with self.assertRaises(SystemExit):
            client.check_download_url("http://api.pixellab.ai/v2/thing")

    def test_unlisted_host_rejected(self):
        with self.assertRaises(SystemExit):
            client.check_download_url("https://evil.example.com/x.png")

    def test_suffix_spoof_rejected(self):
        # evilpixellab.ai must not match the pixellab.ai allow-list entry
        with self.assertRaises(SystemExit):
            client.check_download_url("https://evilpixellab.ai/x.png")


class SafeMemberName(unittest.TestCase):
    def test_plain_key_passes_through(self):
        self.assertEqual(client.safe_member_name("grass_01"), "grass_01")

    def test_path_components_stripped(self):
        self.assertEqual(client.safe_member_name("../../etc/passwd"), "passwd")
        self.assertEqual(client.safe_member_name("a\\b\\c.png"), "c.png")

    def test_special_characters_replaced(self):
        self.assertEqual(client.safe_member_name("a b/c:d.png"), "c_d.png")

    def test_dot_only_names_rejected(self):
        for bad in ("..", ".", "", "///"):
            with self.assertRaises(SystemExit):
                client.safe_member_name(bad)


class SafeExtract(unittest.TestCase):
    def test_normal_zip_extracts(self):
        zf = make_zip([("a.png", b"x"), ("sub/b.json", b"{}")])
        with tempfile.TemporaryDirectory() as dest:
            count = client.safe_extract(zf, dest)
            self.assertEqual(count, 2)
            self.assertTrue(os.path.isfile(os.path.join(dest, "a.png")))
            self.assertTrue(os.path.isfile(os.path.join(dest, "sub", "b.json")))

    def test_traversal_member_rejected(self):
        zf = make_zip([("../escape.png", b"x")])
        with tempfile.TemporaryDirectory() as dest:
            with self.assertRaises(SystemExit):
                client.safe_extract(zf, dest)
            self.assertFalse(os.path.exists(os.path.join(dest, "..", "escape.png")))

    def test_disallowed_extension_rejected(self):
        zf = make_zip([("payload.exe", b"MZ")])
        with tempfile.TemporaryDirectory() as dest:
            with self.assertRaises(SystemExit):
                client.safe_extract(zf, dest)

    def test_entry_count_cap(self):
        original = client.ZIP_MAX_ENTRIES
        client.ZIP_MAX_ENTRIES = 2
        try:
            zf = make_zip([(f"f{i}.png", b"x") for i in range(3)])
            with tempfile.TemporaryDirectory() as dest:
                with self.assertRaises(SystemExit):
                    client.safe_extract(zf, dest)
        finally:
            client.ZIP_MAX_ENTRIES = original

    def test_total_bytes_cap_enforced_on_actual_stream(self):
        original = client.ZIP_MAX_TOTAL_BYTES
        client.ZIP_MAX_TOTAL_BYTES = 10
        try:
            zf = make_zip([("big.png", b"x" * 64)])
            with tempfile.TemporaryDirectory() as dest:
                with self.assertRaises(SystemExit):
                    client.safe_extract(zf, dest)
        finally:
            client.ZIP_MAX_TOTAL_BYTES = original


class FakeResponse:
    """Minimal stand-in for requests.Response supporting the streamed paths."""

    def __init__(self, status=200, headers=None, chunks=(b"",)):
        self.status_code = status
        self.headers = headers or {}
        self._chunks = chunks
        self.text = ""

    def iter_content(self, _size):
        return iter(self._chunks)

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


PNG_BODY = (b"\x89PNG\r\n\x1a\n", b"rest")


class FetchBinaryRedirects(unittest.TestCase):
    def fetch(self, responses):
        """Run fetch_binary('https://api.pixellab.ai/x.png') against a queue of
        fake responses, returning (result, urls actually requested)."""
        seen = []

        def fake_get(url, **kwargs):
            self.assertFalse(kwargs.get("allow_redirects", True),
                             "fetch_binary must disable auto-redirects")
            seen.append(url)
            return responses[len(seen) - 1]

        with mock.patch.object(client.requests, "get", side_effect=fake_get):
            return client.fetch_binary("https://api.pixellab.ai/x.png"), seen

    def test_allowed_redirect_hop_is_followed(self):
        content, seen = self.fetch([
            FakeResponse(302, {"location": "https://f005.backblazeb2.com/y.png"}),
            FakeResponse(200, chunks=PNG_BODY),
        ])
        self.assertTrue(content.startswith(b"\x89PNG"))
        self.assertEqual(seen[1], "https://f005.backblazeb2.com/y.png")

    def test_redirect_to_http_rejected(self):
        with self.assertRaises(SystemExit):
            self.fetch([
                FakeResponse(302, {"location": "http://api.pixellab.ai/y.png"}),
            ])

    def test_redirect_to_unlisted_host_rejected(self):
        with self.assertRaises(SystemExit):
            self.fetch([
                FakeResponse(302, {"location": "https://evil.example.com/y.png"}),
            ])

    def test_redirect_to_internal_host_rejected(self):
        for internal in ("https://localhost/y.png", "https://127.0.0.1/y.png",
                         "https://169.254.169.254/latest/meta-data"):
            with self.assertRaises(SystemExit):
                self.fetch([FakeResponse(302, {"location": internal})])

    def test_redirect_loop_bounded(self):
        hop = FakeResponse(302, {"location": "https://api.pixellab.ai/x.png"})
        with self.assertRaises(SystemExit):
            self.fetch([hop] * (client.MAX_REDIRECTS + 2))

    def test_download_cap_enforced(self):
        original = client.MAX_DOWNLOAD_BYTES
        client.MAX_DOWNLOAD_BYTES = 10
        try:
            with self.assertRaises(SystemExit):
                self.fetch([FakeResponse(200, chunks=(b"\x89PNG\r\n\x1a\n" * 8,))])
        finally:
            client.MAX_DOWNLOAD_BYTES = original


class ApiRawStreamingCap(unittest.TestCase):
    def test_raw_response_over_cap_rejected(self):
        original = client.MAX_DOWNLOAD_BYTES
        client.MAX_DOWNLOAD_BYTES = 10

        def fake_request(method, url, **kwargs):
            self.assertTrue(kwargs.get("stream"), "raw path must stream")
            return FakeResponse(200, chunks=(b"z" * 64,))

        try:
            with mock.patch.object(client.requests, "request", side_effect=fake_request), \
                 mock.patch.object(client, "get_token", return_value="test-token"):
                with self.assertRaises(SystemExit):
                    client.api("GET", "/characters/abc/zip", raw=True)
        finally:
            client.MAX_DOWNLOAD_BYTES = original

    def test_raw_response_under_cap_returned(self):
        def fake_request(method, url, **kwargs):
            return FakeResponse(200, chunks=(b"PK\x03\x04", b"zipdata"))

        with mock.patch.object(client.requests, "request", side_effect=fake_request), \
             mock.patch.object(client, "get_token", return_value="test-token"):
            blob = client.api("GET", "/characters/abc/zip", raw=True)
        self.assertEqual(blob, b"PK\x03\x04zipdata")

    def test_raw_redirect_rejected_and_not_followed(self):
        # Security blocker regression: an API 3xx must fail closed, never be
        # auto-followed with the bearer token attached.
        calls = []

        def fake_request(method, url, **kwargs):
            self.assertFalse(kwargs.get("allow_redirects", True),
                             "authenticated raw path must disable auto-redirects")
            calls.append(url)
            return FakeResponse(302, {"location": "https://evil.example.com/zip"})

        with mock.patch.object(client.requests, "request", side_effect=fake_request), \
             mock.patch.object(client, "get_token", return_value="test-token"):
            with self.assertRaises(SystemExit):
                client.api("GET", "/characters/abc/zip", raw=True)
        self.assertEqual(len(calls), 1, "redirect must not be followed")

    def test_json_redirect_rejected_and_not_followed(self):
        calls = []

        def fake_request(method, url, **kwargs):
            self.assertFalse(kwargs.get("allow_redirects", True),
                             "authenticated JSON path must disable auto-redirects")
            calls.append(url)
            return FakeResponse(301, {"location": "http://internal.local/steal"})

        with mock.patch.object(client.requests, "request", side_effect=fake_request), \
             mock.patch.object(client, "get_token", return_value="test-token"):
            with self.assertRaises(SystemExit):
                client.api("GET", "/balance")
        self.assertEqual(len(calls), 1, "redirect must not be followed")


class UniqueSafeNames(unittest.TestCase):
    def test_distinct_keys_pass(self):
        names = client.unique_safe_names(["grass_01", "soil_02"])
        self.assertEqual(names, {"grass_01": "grass_01", "soil_02": "soil_02"})

    def test_collision_after_sanitization_rejected(self):
        # 'a b' and 'a?b' both sanitize to 'a_b' — silent overwrite forbidden
        # (avoid ':' here: ntpath.basename treats 'a:b' as drive-relative)
        with self.assertRaises(SystemExit):
            client.unique_safe_names(["a b", "a?b"])


if __name__ == "__main__":
    unittest.main()
