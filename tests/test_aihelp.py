"""Pomocnik AI: the keys stay local, questions carry the rig, answers come back with action buttons,
a busy / used-up service hands the question to the next key.
No network: Gemini / Groq / OpenRouter (urllib) and Claude (SDK) are replaced by fakes."""
import io
import json
import sys
import tempfile
import types
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import aihelp  # noqa: E402
from aihelp import AIHelper, provider_of, rig_context, split_actions  # noqa: E402


class FakeResp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def gemini_reply(text):
    return FakeResp(json.dumps({"candidates": [{"content": {"parts": [{"text": text}]}}]}).encode())


class TestAIHelper(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "ai_key.txt"

    def tearDown(self):
        self.tmp.cleanup()

    def test_kind_of_key(self):
        self.assertEqual(provider_of("AIzaSyA-1234567890abcdefgh"), "gemini")
        self.assertEqual(provider_of("AQ.Ab8FAKEfakeFAKEfake_0123456789"), "gemini")   # the newer Google "auth key"
        self.assertEqual(provider_of(" sk-ant-api03-xyz "), "claude")
        self.assertEqual(provider_of("gsk_FAKEfakeFAKEfake0123"), "groq")
        self.assertEqual(provider_of("sk-or-v1-FAKEfakeFAKE0123"), "openrouter")
        self.assertEqual(provider_of("csk-FAKEfakeFAKEfake0123"), "cerebras")
        self.assertIsNone(provider_of("hello"))
        self.assertIsNone(provider_of("AQ.Ab8 with spaces inside it"))
        self.assertIsNone(provider_of(""))

    def test_key_is_kept_only_in_its_file(self):
        h = AIHelper(self.path)
        self.assertFalse(h.state()["on"])
        with self.assertRaises(ValueError):
            h.set_key("not a key")
        st = h.set_key("AIzaSyTESTKEY1234567890")
        self.assertTrue(st["on"])
        self.assertEqual(st["provider"], "gemini")
        self.assertNotIn("TESTKEY", st["masked"])                    # never the whole key back to the browser
        self.assertEqual(self.path.read_text(encoding="utf-8"), "gemini:AIzaSyTESTKEY1234567890\n")
        self.assertTrue(AIHelper(self.path).state()["on"])           # survives a restart
        h.set_key("")
        self.assertFalse(self.path.exists())

    def test_several_keys_old_file_and_removing_one(self):
        self.path.write_text("AQ.Ab8FAKEfakeFAKEfake_0123456789\n", encoding="utf-8")   # the file of 5.2 (one bare key)
        h = AIHelper(self.path)
        self.assertEqual(h.state()["keys"][0]["provider"], "gemini")
        st = h.add_key("gsk_FAKEfakeFAKEfake0123")
        self.assertEqual([k["name"] for k in st["keys"]], ["Google Gemini", "Groq"])
        h.add_key("gsk_FAKEfakeFAKEfake0123")                          # the same key twice is kept once
        self.assertEqual(len(h.state()["keys"]), 2)
        st = h.remove_key(0)
        self.assertEqual([k["provider"] for k in st["keys"]], ["groq"])
        self.assertEqual(AIHelper(self.path).state()["keys"][0]["provider"], "groq")

    def test_actions_are_split_from_the_answer(self):
        r = split_actions("Ustaw adres d001.\n\n[[rig]] [[cal]] [[evil]] [[rig]]")
        self.assertEqual(r["text"], "Ustaw adres d001.")
        self.assertEqual(r["actions"], ["go:rig", "go:cal"])
        r = split_actions("Gotowe.\n[[go:setup/library]] [[show:blackout]] [[do:channels=37|pan,tilt,dimmer]] [[run:rm -rf]]")
        self.assertEqual(r["actions"], ["go:setup/library", "show:blackout", "do:channels=37|pan,tilt,dimmer"])

    def test_no_key_no_question(self):
        h = AIHelper(self.path)
        self.assertEqual(h.ask("hej", [], "")["error"], "no_key")
        h.set_key("AIzaSyTESTKEY1234567890")
        self.assertEqual(h.ask("   ", [], "")["error"], "empty")

    def test_gemini_question_carries_the_rig_and_history(self):
        h = AIHelper(self.path)
        h.set_key("AIzaSyTESTKEY1234567890")
        sent = {}

        def fake(req, timeout=0):
            sent["url"] = req.full_url
            sent["headers"] = dict(req.header_items())
            sent["body"] = json.loads(req.data.decode())
            return gemini_reply("Kliknij **Mrugnij**.\n[[rig]]")

        hist = [{"role": "assistant", "text": "stray"}, {"role": "user", "text": "pierwsze"},
                {"role": "assistant", "text": "odp"}]
        with mock.patch.object(aihelp.urllib.request, "urlopen", fake):
            r = h.ask("Która to lampa?", hist, "- \"Głowice prawe ×3\" type moving_head")
        self.assertEqual(r, {"text": "Kliknij **Mrugnij**.", "actions": ["go:rig"], "provider": "Google Gemini"})
        self.assertNotIn("key=", sent["url"])                         # the key goes in a header, not the URL
        self.assertEqual(sent["headers"].get("X-goog-api-key"), "AIzaSyTESTKEY1234567890")
        self.assertIn("Głowice prawe", sent["body"]["systemInstruction"]["parts"][0]["text"])
        roles = [c["role"] for c in sent["body"]["contents"]]
        self.assertEqual(roles, ["user", "model", "user"])            # starts with the user, alternates
        self.assertEqual(sent["body"]["contents"][-1]["parts"][0]["text"], "Która to lampa?")

    def test_gemini_errors_become_short_codes(self):
        h = AIHelper(self.path)
        h.set_key("AIzaSyTESTKEY1234567890")

        def http(code, msg=""):
            def f(req, timeout=0):
                raise urllib.error.HTTPError(req.full_url, code, "x", {}, io.BytesIO(msg.encode()))
            return f
        with mock.patch.object(aihelp.urllib.request, "urlopen", http(400, '{"reason": "API_KEY_INVALID"}')):
            self.assertEqual(h.ask("q", [], "")["error"], "bad_key")
        with mock.patch.object(aihelp.urllib.request, "urlopen", http(429)):
            self.assertEqual(h.ask("q", [], "")["error"], "limit")               # every model out of free quota

        def offline(req, timeout=0):
            raise urllib.error.URLError("no route")
        with mock.patch.object(aihelp.urllib.request, "urlopen", offline):
            self.assertEqual(h.ask("q", [], "")["error"], "offline")

    def test_gemini_falls_back_to_the_fixed_model_name(self):
        h = AIHelper(self.path)
        h.set_key("AIzaSyTESTKEY1234567890")
        urls = []

        def fake(req, timeout=0):
            urls.append(req.full_url)
            if "latest" in req.full_url:
                raise urllib.error.HTTPError(req.full_url, 404, "gone", {}, io.BytesIO(b""))
            return gemini_reply("OK")
        with mock.patch.object(aihelp.urllib.request, "urlopen", fake):
            self.assertEqual(h.ask("q", [], "")["text"], "OK")
        self.assertEqual(len(urls), 2)

    def test_closed_or_used_up_model_tries_the_next_one(self):
        h = AIHelper(self.path)
        h.set_key("AQ.Ab8FAKEfakeFAKEfake_0123456789")
        codes = iter([403, 429])

        def fake(req, timeout=0):
            code = next(codes, None)
            if code:
                raise urllib.error.HTTPError(req.full_url, code, "no", {}, io.BytesIO(b'{"error": "model not available"}'))
            return gemini_reply("Gotowe")
        with mock.patch.object(aihelp.urllib.request, "urlopen", fake):
            self.assertEqual(h.ask("q", [], "")["text"], "Gotowe")

    def test_busy_gemini_hands_over_to_groq(self):
        h = AIHelper(self.path)
        h.add_key("AQ.Ab8FAKEfakeFAKEfake_0123456789")
        h.add_key("gsk_FAKEfakeFAKEfake0123")
        seen = []

        def fake(req, timeout=0):
            url = req.full_url
            seen.append(url)
            if "googleapis" in url:                                      # every Gemini model is overloaded
                raise urllib.error.HTTPError(url, 503, "busy", {}, io.BytesIO(b'{"error": "overloaded"}'))
            if url.endswith("/models"):
                return FakeResp(json.dumps({"data": [{"id": "whisper-large-v3"}, {"id": "llama-3.1-8b-instant"},
                                                     {"id": "openai/gpt-oss-120b"}]}).encode())
            body = json.loads(req.data.decode())
            self.assertEqual(body["model"], "openai/gpt-oss-120b")         # the best one the service has
            self.assertEqual(body["messages"][0]["role"], "system")
            self.assertEqual(dict(req.header_items())["Authorization"], "Bearer gsk_FAKEfakeFAKEfake0123")
            return FakeResp(json.dumps({"choices": [{"message": {"content": "<think>hm</think>Groq tu. [[go:rig]]"}}]}).encode())
        with mock.patch.object(aihelp.urllib.request, "urlopen", fake):
            r = h.ask("q", [], "")
        self.assertEqual(r, {"text": "Groq tu.", "actions": ["go:rig"], "provider": "Groq"})
        self.assertEqual(sum("googleapis" in u for u in seen), len(aihelp.GEMINI_MODELS))

    def test_openrouter_uses_only_free_models(self):
        h = AIHelper(self.path)
        h.add_key("sk-or-v1-FAKEfakeFAKE0123")
        models = []

        def fake(req, timeout=0):
            if req.full_url.endswith("/models"):
                return FakeResp(json.dumps({"data": [
                    {"id": "big/paid-model", "pricing": {"prompt": "0.000002", "completion": "0.000004"}},
                    {"id": "meta/llama-x:free", "pricing": {"prompt": "0", "completion": "0"}}]}).encode())
            model = json.loads(req.data.decode())["model"]
            models.append(model)
            if model == "openrouter/free":
                raise urllib.error.HTTPError(req.full_url, 404, "no", {}, io.BytesIO(b"{}"))
            return FakeResp(json.dumps({"choices": [{"message": {"content": "ok"}}]}).encode())
        with mock.patch.object(aihelp.urllib.request, "urlopen", fake):
            self.assertEqual(h.ask("q", [], "")["text"], "ok")
        self.assertEqual(models, ["openrouter/free", "meta/llama-x:free"])       # never the paid one

    def test_claude_question(self):
        h = AIHelper(self.path)
        self.path.write_text("sk-ant-api03-TESTKEY000000", encoding="utf-8")
        h = AIHelper(self.path)
        calls = {}

        class Err(Exception):
            pass

        class FakeMessages:
            def create(self, **kw):
                calls.update(kw)
                return types.SimpleNamespace(stop_reason="end_turn", content=[
                    types.SimpleNamespace(type="thinking", thinking=""),
                    types.SimpleNamespace(type="text", text="Ustaw tryb DMX. [[dmx]]")])

        fake_mod = types.SimpleNamespace(
            Anthropic=lambda **kw: types.SimpleNamespace(beta=types.SimpleNamespace(messages=FakeMessages())),
            AuthenticationError=Err, PermissionDeniedError=Err, RateLimitError=Err, APIConnectionError=Err,
            APIStatusError=Err)
        with mock.patch.dict(sys.modules, {"anthropic": fake_mod}):
            r = h.ask("Lampa nie reaguje", [{"role": "user", "text": "a"}, {"role": "assistant", "text": "b"}], "ctx")
        self.assertEqual(r, {"text": "Ustaw tryb DMX.", "actions": ["go:setup/dmx"], "provider": "Claude"})
        self.assertEqual(calls["model"], "claude-opus-5-5")
        self.assertEqual(calls["fallbacks"], "default")
        self.assertEqual([m["role"] for m in calls["messages"]], ["user", "assistant", "user"])
        self.assertIn("ctx", calls["system"])

    def test_rig_context_is_readable(self):
        snap = {"fixtures": [{"id": 1, "name": "PAR ×4", "type": "par", "model": None, "address": 60, "footprint": 3,
                              "channels": ["red", "green", "blue"], "mount": "stand", "enabled": True}],
                "dmx": {"label": "Open DMX", "ok": False, "conflicts": []}, "lasers_enabled": False, "held": [1]}
        txt = rig_context(snap, {"autopilot": {"on": True}, "bpm": 124.2, "clock": {"locked": True},
                                 "section": {"name": "chorus"}},
                          {"flavor": "club", "cfg": {"intensity": 0.6}, "look_pl": "Fala"},
                          {"silent": False, "genre_pl": "Pop", "mood_pl": "radosny", "song": None},
                          [{"name": "Saksofonista"}])
        for part in ("id 1 ", "PAR ×4", "address 60", "1:red", "NOT connected", "124 BPM", "chorus", "Pop", "Saksofonista",
                     "Held by hand"):
            self.assertIn(part, txt)


if __name__ == "__main__":
    unittest.main()
