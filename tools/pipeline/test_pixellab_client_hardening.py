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


if __name__ == "__main__":
    unittest.main()
