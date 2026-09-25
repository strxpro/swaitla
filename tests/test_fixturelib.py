"""Lumo fixture identification tests:  .venv\\Scripts\\python -m unittest discover -s tests -v"""

from __future__ import annotations

import io
import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import unittest
import zipfile
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from fixturelib import (ChannelType as CT, FixtureLibraryService, FixtureMatcher, GdtfFixtureAdapter,  # noqa: E402
                        OflFixtureAdapter, QlcFixtureAdapter, SpotlyFixtureDefinition, probe_plan, to_engine_spec)
from fixturelib import manual, rdm, search as fsearch  # noqa: E402
from fixturelib import service as fservice  # noqa: E402

QXF = b"""<?xml version="1.0" encoding="UTF-8"?>
<FixtureDefinition xmlns="http://www.qlcplus.org/FixtureDefinition">
 <Manufacturer>Tomshine</Manufacturer><Model>Mini Gobo Moving Head</Model><Type>Moving Head</Type>
 <Channel Name="Pan" Preset="PositionPan"/><Channel Name="Pan fine" Preset="PositionPanFine"/>
 <Channel Name="Tilt" Preset="PositionTilt"/><Channel Name="Tilt fine" Preset="PositionTiltFine"/>
 <Channel Name="Color"><Group Byte="0">Colour</Group>
  <Capability Min="0" Max="9" Preset="ColorMacro" Res1="#ffffff">White</Capability>
  <Capability Min="10" Max="19" Preset="ColorMacro" Res1="#ff0000">Red</Capability></Channel>
 <Channel Name="Gobo"><Group Byte="0">Gobo</Group><Capability Min="0" Max="7">Open</Capability><Capability Min="8" Max="15">Gobo 1</Capability></Channel>
 <Channel Name="Strobe"><Group Byte="0">Shutter</Group><Capability Min="0" Max="7">Open</Capability><Capability Min="8" Max="255" Preset="StrobeSlowToFast">Strobe</Capability></Channel>
 <Channel Name="Dimmer" Preset="IntensityMasterDimmer"/>
 <Channel Name="Speed" Preset="SpeedPanTiltFastSlow"/>
 <Channel Name="Auto"><Group Byte="0">Effect</Group><Capability Min="0" Max="59">No function</Capability><Capability Min="60" Max="255">Sound mode</Capability></Channel>
 <Channel Name="Reset"><Group Byte="0">Maintenance</Group><Capability Min="0" Max="249">No function</Capability><Capability Min="250" Max="255">Reset</Capability></Channel>
 <Mode Name="11 Channel"><Channel Number="0">Pan</Channel><Channel Number="1">Pan fine</Channel><Channel Number="2">Tilt</Channel>
  <Channel Number="3">Tilt fine</Channel><Channel Number="4">Color</Channel><Channel Number="5">Gobo</Channel><Channel Number="6">Strobe</Channel>
  <Channel Number="7">Dimmer</Channel><Channel Number="8">Speed</Channel><Channel Number="9">Auto</Channel><Channel Number="10">Reset</Channel></Mode>
 <Mode Name="9 Channel"><Channel Number="0">Pan</Channel><Channel Number="1">Tilt</Channel><Channel Number="2">Color</Channel>
  <Channel Number="3">Gobo</Channel><Channel Number="4">Strobe</Channel><Channel Number="5">Dimmer</Channel><Channel Number="6">Speed</Channel>
  <Channel Number="7">Auto</Channel><Channel Number="8">Reset</Channel></Mode>
 <Physical><Focus Type="Head" PanMax="540" TiltMax="180"/><Lens Name="Other" DegreesMin="12" DegreesMax="12"/></Physical>
</FixtureDefinition>"""

OFL = {
    "name": "Party Spot 7", "categories": ["Moving Head"],
    "physical": {"focus": {"panMax": 540, "tiltMax": 270}, "lens": {"degreesMinMax": [15, 15]}},
    "availableChannels": {
        "Pan": {"fineChannelAliases": ["Pan fine"], "capability": {"type": "Pan", "angleStart": "0deg", "angleEnd": "540deg"}},
        "Tilt": {"capability": {"type": "Tilt", "angleStart": "0deg", "angleEnd": "270deg"}},
        "Dimmer": {"capability": {"type": "Intensity"}},
        "Shutter": {"capabilities": [{"dmxRange": [0, 9], "type": "ShutterStrobe", "shutterEffect": "Open"},
                                     {"dmxRange": [10, 255], "type": "ShutterStrobe", "shutterEffect": "Strobe"}]},
        "Color Wheel": {"capabilities": [{"dmxRange": [0, 15], "type": "WheelSlot", "slotNumber": 1, "comment": "White", "colors": ["#ffffff"]},
                                         {"dmxRange": [16, 31], "type": "WheelSlot", "slotNumber": 2, "comment": "Red", "colors": ["#ff0000"]}]},
        "Red": {"capability": {"type": "ColorIntensity", "color": "Red"}},
        "Program": {"capabilities": [{"dmxRange": [0, 127], "type": "NoFunction"},
                                     {"dmxRange": [128, 255], "type": "Effect", "effectName": "Sound", "soundControlled": True}]},
    },
    "modes": [{"name": "7-channel", "shortName": "7ch", "channels": ["Pan", "Pan fine", "Tilt", "Dimmer", "Shutter", "Color Wheel", "Program"]},
              {"name": "3-channel", "channels": ["Dimmer", "Red", None]}],
}

GDTF_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<GDTF DataVersion="1.1"><FixtureType Name="Beam7" LongName="Beam 7R" Manufacturer="Acme" ShortName="B7" Description="moving head">
 <DMXModes><DMXMode Name="Basic"><DMXChannels>
  <DMXChannel Offset="1,2" Default="32768/2"><LogicalChannel Attribute="Pan"><ChannelFunction Name="Pan" DMXFrom="0/1"/></LogicalChannel></DMXChannel>
  <DMXChannel Offset="3"><LogicalChannel Attribute="Tilt"><ChannelFunction Name="Tilt" DMXFrom="0/1"/></LogicalChannel></DMXChannel>
  <DMXChannel Offset="4"><LogicalChannel Attribute="Dimmer"><ChannelFunction Name="Dimmer" DMXFrom="0/1"/></LogicalChannel></DMXChannel>
  <DMXChannel Offset="5"><LogicalChannel Attribute="Shutter1"><ChannelFunction Name="Open" DMXFrom="0/1"/><ChannelFunction Name="Strobe" DMXFrom="32/1"/></LogicalChannel></DMXChannel>
  <DMXChannel Offset="6"><LogicalChannel Attribute="Control1"><ChannelFunction Name="No function" DMXFrom="0/1"/><ChannelFunction Name="Reset" DMXFrom="200/1"/></LogicalChannel></DMXChannel>
 </DMXChannels></DMXMode></DMXModes>
 <Protocols><FTRDM ManufacturerID="0x4142" DeviceModelID="0x0007"/></Protocols>
</FixtureType></GDTF>"""


def gdtf_zip() -> bytes:
    b = io.BytesIO()
    with zipfile.ZipFile(b, "w") as z:
        z.writestr("description.xml", GDTF_XML)
    return b.getvalue()


def tiny_pdf(lines: list[str]) -> bytes:
    """A real (minimal) PDF with a Flate-compressed text stream."""
    ops = "BT /F1 12 Tf 50 750 Td " + " ".join(f"({ln}) Tj T*" for ln in lines) + " ET"
    stream = zlib.compress(ops.encode("latin-1"))
    return (b"%PDF-1.4\n1 0 obj << /Length " + str(len(stream)).encode() + b" /Filter /FlateDecode >>\nstream\n"
            + stream + b"\nendstream\nendobj\ntrailer << >>\n%%EOF")


# =============================================================================
class TestAdapters(unittest.TestCase):
    def test_qxf_import(self):
        d = QlcFixtureAdapter().parse(QXF, "mini.qxf")
        self.assertEqual((d.manufacturer, d.model, d.category, d.source), ("Tomshine", "Mini Gobo Moving Head", "moving_head", "qlc"))
        self.assertEqual([m.count for m in d.modes], [11, 9])
        m = d.mode(11)
        self.assertEqual([c.type for c in m.channels][:4], [CT.Pan, CT.PanFine, CT.Tilt, CT.TiltFine])
        self.assertEqual(m.channels[7].type, CT.MasterDimmer)
        self.assertEqual(m.channels[10].type, CT.Reset)
        self.assertEqual(d.physical["pan_deg"], 540)
        self.assertEqual(m.channels[4].capabilities[1].color, "#ff0000")

    def test_ofl_import(self):
        d = OflFixtureAdapter().parse(OFL, "acme/party-spot-7", "Acme")
        self.assertEqual(d.id, "ofl:acme/party-spot-7")
        m = d.mode("7ch")
        self.assertEqual([c.type for c in m.channels], [CT.Pan, CT.PanFine, CT.Tilt, CT.Dimmer, CT.Shutter, CT.ColorWheel, CT.SoundProgram])
        self.assertEqual(d.modes[1].channels[2].type, CT.Unknown)           # null channel in OFL
        self.assertEqual(d.physical["tilt_deg"], 270)
        shutter = m.channels[4].capabilities
        self.assertEqual((shutter[0].semantic, shutter[1].semantic), ("open", "strobe"))

    def test_gdtf_import(self):
        d = GdtfFixtureAdapter().parse(gdtf_zip(), "b7.gdtf")
        self.assertEqual((d.manufacturer, d.model), ("Acme", "Beam 7R"))
        m = d.modes[0]
        self.assertEqual([c.type for c in m.channels], [CT.Pan, CT.PanFine, CT.Tilt, CT.Dimmer, CT.Shutter, CT.Reset])
        self.assertEqual(m.channels[4].capabilities[1].min, 32)
        self.assertEqual(d.rdm, {"manufacturer_id": 0x4142, "model_id": 7})
        self.assertEqual(m.channels[0].default, 128)


class TestChannelMapping(unittest.TestCase):
    def test_engine_spec(self):
        d = QlcFixtureAdapter().parse(QXF)
        s = to_engine_spec(d, d.mode(11))
        self.assertEqual(s["channels"], ["pan", "pan_fine", "tilt", "tilt_fine", "cwheel", "gobo", "shutter", "dimmer", "speed", "auto", "reset"])
        self.assertEqual((s["shutter_open"], s["strobe_min"], s["strobe_max"]), (3, 8, 255))
        self.assertEqual(s["wheel"][1], [14, [255, 0, 0], "Red"])
        self.assertTrue(s["pan_16bit"] and s["tilt_16bit"])
        self.assertNotIn("10", s["defaults"])                               # never a default on reset

    def test_duplicate_driven_roles_are_neutralised(self):
        d = SpotlyFixtureDefinition.from_dict({"id": "mine:x", "manufacturer": "X", "model": "Y", "modes": [{"name": "6CH", "channels": [
            {"type": "Pan"}, {"type": "Pan"}, {"type": "Red"}, {"type": "Red"}, {"type": "PanTiltSpeed"}, {"type": "MotorSpeed"}]}]})
        self.assertEqual(to_engine_spec(d, d.modes[0])["channels"], ["pan", "other", "red", "red", "speed", "other"])

    def test_engine_renders_defaults_and_gates_lasers(self):
        import dmx_controller as dc
        e = dc.DMXEngine()
        f = e.add_fixture(name="T", address=1, channels=["dimmer", "zoom", "laser_r", "reset"], defaults={"1": 90, "2": 200, "3": 255})
        e.set_param(f.id, "dimmer", 255); f.snap()
        e._render()
        self.assertEqual(list(e.universe[:4]), [255, 90, 0, 0])                # reset never gets its default
        self.assertEqual(e.universe[2], 0)                                  # laser default ignored while disarmed
        e.chan_set(f.id, 2, 180)
        e._render()
        self.assertEqual(e.universe[2], 0)                                  # laser override gated too
        e.lasers_enabled = True
        e._render()
        self.assertEqual(e.universe[2], 180)


class TestAddresses(unittest.TestCase):
    def test_collision_and_free_address(self):
        import dmx_controller as dc
        e = dc.DMXEngine()
        a = e.add_fixture(name="Dragonfly", address=1, channels=["dimmer"] * 21)
        e.add_fixture(name="Moving", address=22, channels=["dimmer"] * 16)
        c = e.add_fixture(name="Mini", address=30, channels=["dimmer"] * 11)
        self.assertTrue(any("Mini" in x or "Moving" in x for x in e.address_conflicts()))
        self.assertEqual(e.free_address(11, skip=c.id), 38)
        e.update_fixture(c.id, address=e.free_address(11, skip=c.id))
        self.assertEqual(e.address_conflicts(), [])
        self.assertEqual(e.free_address(21, skip=a.id), 1)


class TestSearchAndMatching(unittest.TestCase):
    INDEX = [
        {"id": "qlc:tomshine-mini-gobo", "manufacturer": "Tomshine", "model": "Mini Gobo Moving Head", "category": "moving_head", "modes": [["11 Channel", 11], ["9 Channel", 9]], "source": "qlc"},
        {"id": "qlc:led-spot-30w", "manufacturer": "Generic", "model": "30W LED Spot", "category": "moving_head", "modes": [["9ch", 9]], "source": "qlc"},
        {"id": "qlc:rush-mh3", "manufacturer": "Martin", "model": "Rush MH3", "category": "moving_head", "modes": [["19ch", 19]], "source": "qlc"},
        {"id": "ofl:beam-60w", "manufacturer": "Generic", "model": "Beam 60W", "category": "moving_head", "modes": [], "source": "ofl"},
        {"id": "qlc:par", "manufacturer": "Eurolite", "model": "LED PAR-56 RGB", "category": "par", "modes": [["5ch", 5]], "source": "qlc"},
    ]

    def top(self, q, **kw):
        r = fsearch.search(q, [dict(e) for e in self.INDEX], **kw)
        return r[0]["id"] if r else None

    def test_fixture_search(self):
        self.assertEqual(self.top("Mini Gobo Moving Head"), "qlc:tomshine-mini-gobo")
        self.assertEqual(self.top("LED Spot 30W"), "qlc:led-spot-30w")
        self.assertEqual(self.top("Beam 60W"), "ofl:beam-60w")
        self.assertEqual(self.top("par 56"), "qlc:par")
        self.assertIsNone(self.top("gobo", channels=5))

    def test_fuzzy(self):
        self.assertEqual(self.top("mini gobbo moving hed"), "qlc:tomshine-mini-gobo")   # typos
        self.assertEqual(self.top("MH-3"), "qlc:rush-mh3")                            # dash / joined
        self.assertEqual(self.top("mh 3"), "qlc:rush-mh3")
        self.assertEqual(self.top("led spot 30 w"), "qlc:led-spot-30w")               # "30 W" = "30W"
        self.assertEqual(self.top("minigobo 11ch"), "qlc:tomshine-mini-gobo")          # glued words + channel filter

    def test_matcher_scoring(self):
        a = QlcFixtureAdapter().parse(QXF)
        b = SpotlyFixtureDefinition.from_dict({"id": "mine:other", "manufacturer": "X", "model": "Other 11", "modes": [{"name": "11CH", "channels": [
            {"type": t} for t in ["Dimmer", "Red", "Green", "Blue", "Strobe", "Macro", "Pan", "Tilt", "Other", "Other", "Other"]]}]})
        r = FixtureMatcher().rank([a, b], 11, {0: CT.Pan, 2: CT.Tilt, 7: CT.Dimmer, 4: CT.ColorWheel})
        self.assertEqual(r[0]["id"], a.id)
        self.assertGreaterEqual(r[0]["confidence"], 0.95)
        self.assertTrue(all(x["id"] != b.id or x["confidence"] < 0.5 for x in r))
        rd = FixtureMatcher().rank([GdtfFixtureAdapter().parse(gdtf_zip())], None, {}, "", {"manufacturer_id": 0x4142, "model_id": 7})
        self.assertEqual(rd[0]["confidence"], 1.0)

    def test_probe_plan_never_touches_reset(self):
        a = QlcFixtureAdapter().parse(QXF)
        b = SpotlyFixtureDefinition.from_dict({"id": "mine:b", "manufacturer": "B", "model": "B", "modes": [{"name": "11CH", "channels": [
            {"type": t} for t in ["Tilt", "Pan", "Dimmer", "Other", "ColorWheel", "GoboWheel", "Strobe", "MasterDimmer", "PanTiltSpeed", "Macro", "Reset"]]}]})
        plan = probe_plan([(a, a.mode(11)), (b, b.modes[0])])
        offs = [s["offset"] for s in plan["steps"]]
        self.assertTrue(offs)
        self.assertNotIn(10, offs)
        self.assertEqual(plan["base"].get("7"), 200)                        # dimmer both agree on -> lamp visible


class TestServiceCacheAndProfiles(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.qdir = self.tmp / "qlc"
        self.qdir.mkdir()
        (self.qdir / "mini.qxf").write_bytes(QXF)
        (self.tmp / "lib.json").write_text(json.dumps([{"key": "par-4", "model": "PAR RGBW", "type": "par", "channels": ["red", "green", "blue", "white"]}]))
        self._orig = fservice.qlc_dirs
        fservice.qlc_dirs = lambda: [str(self.qdir)]

    def tearDown(self):
        fservice.qlc_dirs = self._orig
        shutil.rmtree(self.tmp, ignore_errors=True)

    def svc(self):
        return FixtureLibraryService(self.tmp, self.tmp / "lib.json", online=False)

    def test_offline_cache(self):
        s = self.svc()
        s.cache.mkdir(exist_ok=True)
        s.rebuild()
        self.assertTrue((s.cache / "library_index.json").exists())
        s2 = self.svc()
        s2._load_cached_index()                       # no parsing, no internet
        self.assertTrue(s2.ready)
        self.assertEqual(len(s2.index), 1)
        self.assertEqual(s2.search("mini gobo")[0]["id"], "qlc:tomshine-mini-gobo-moving-head")
        self.assertEqual(s2.get("qlc:tomshine-mini-gobo-moving-head").mode(9).count, 9)

    def test_calibration_save_load_and_alias(self):
        s = self.svc()
        s.cache.mkdir(exist_ok=True)
        s.rebuild()
        prof = {"manufacturer": "Moje", "model": "x", "category": "moving_head",
                "modes": [{"name": "3CH", "channels": [{"name": "Pan", "type": "Pan"}, {"name": "Tilt", "type": "Tilt"}, {"name": "Dim", "type": "Dimmer"}]}]}
        d = s.save_profile(prof, "Mini Gobo 11CH Antonio")
        self.assertTrue(d.id.startswith("mine:"))
        again = self.svc().get(d.id)
        self.assertEqual(again.model, "Mini Gobo 11CH Antonio")
        self.assertEqual([c.type for c in again.modes[0].channels], [CT.Pan, CT.Tilt, CT.Dimmer])
        self.assertEqual(s.search("antonio")[0]["id"], d.id)                     # "learn this fixture": one click next time
        s.add_alias("moja lampa ogrod", "qlc:tomshine-mini-gobo-moving-head")
        r = s.search("Moja lampa ogród")
        self.assertTrue(r[0].get("alias"))
        spec = s.engine_spec(d.id, None)
        self.assertEqual(spec["channels"], ["pan", "tilt", "dimmer"])
        s.delete_profile(d.id)
        self.assertFalse(any(e["id"] == d.id for e in s.mine_entries()))

    def test_legacy_library_is_searchable(self):
        s = self.svc()
        self.assertEqual(s.search("par rgbw")[0]["id"], "spotly:par-4")


class TestRdm(unittest.TestCase):
    def test_packet_roundtrip(self):
        uid = rdm.Uid(0x4142, 0x01020304)
        pkt = rdm.build_request(uid, rdm.GET_COMMAND, rdm.PID["DEVICE_INFO"])
        self.assertEqual(pkt[0], 0xCC)
        self.assertEqual(struct.unpack(">H", pkt[-2:])[0], rdm.checksum(pkt[:-2]))
        info = struct.pack(">HHHIHBBHHB", 0x0100, 7, 0x0101, 0x01000000, 11, 2, 3, 38, 0, 0)
        body = bytes([0xCC, 0x01, 24 + len(info)]) + rdm.Uid(*rdm.CONTROLLER_UID).pack() + uid.pack() + bytes([0, 0, 0]) \
            + b"\x00\x00" + bytes([rdm.GET_COMMAND_RESPONSE]) + struct.pack(">H", 0x60) + bytes([len(info)]) + info
        resp = rdm.parse_response(body + struct.pack(">H", rdm.checksum(body)))
        d = rdm.decode_device_info(resp.data)
        self.assertEqual((d["model_id"], d["footprint"], d["start_address"], d["personality_count"]), (7, 11, 38, 3))
        with self.assertRaises(ValueError):
            rdm.parse_response(body + b"\x00\x00")

    def test_unavailable_fallback(self):
        class OpenDmx:
            name = "opendmx"
        self.assertIsNone(rdm.controller_for(OpenDmx()))
        self.assertEqual(rdm.why_unavailable(OpenDmx()), "opendmx")

        class Fake:
            name = "enttec"

            def discover(self):
                return [rdm.Uid(0x4142, 1)]

            def get(self, uid, pid, data=b""):
                if pid == rdm.PID["DEVICE_INFO"]:
                    return rdm.RdmResponse(uid, uid, 0x21, pid, 0, struct.pack(">HHHIHBBHHB", 0x100, 7, 0, 1, 11, 1, 1, 38, 0, 0))
                if pid == rdm.PID["MANUFACTURER_LABEL"]:
                    return rdm.RdmResponse(uid, uid, 0x21, pid, 0, b"ADJ\x00")
                return None
        devs = rdm.discover_and_describe(Fake())
        self.assertEqual((devs[0].manufacturer_label, devs[0].footprint, devs[0].start_address), ("ADJ", 11, 38))


class TestManual(unittest.TestCase):
    def test_chart_from_pdf(self):
        pdf = tiny_pdf(["DMX channel chart 9CH", "CH1 Pan", "CH2 Tilt", "CH3 Color wheel", "CH4 Gobo", "CH5 Strobe", "CH6 Dimmer",
                        "CH7 Pan/Tilt speed", "CH8 Auto mode", "CH9 Reset"])
        text = manual.pdf_text(pdf)
        charts = manual.parse_chart(text)
        self.assertEqual(len(charts[0]["channels"]), 9)
        self.assertEqual([c["type"] for c in charts[0]["channels"]],
                         ["Pan", "Tilt", "ColorWheel", "GoboWheel", "Strobe", "Dimmer", "PanTiltSpeed", "AutoProgram", "Reset"])

    def test_shop_title_words(self):
        w = manual.search_words("2PCS 60W Mini LED Moving Head Spot Gobo DMX512 Stage Light DJ Disco Party - AliExpress")
        self.assertIn("Mini", w)
        self.assertNotIn("DJ", w)


class TestAutoControls(unittest.TestCase):
    """The Mikser → Proste controls come from the profile (checked in node with a stub page)."""

    def test_features(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("node not installed")
        script = r"""
const fs = require('fs'), vm = require('vm');
const PH = { S: {}, send() {}, t: (k) => k, esc: (s) => s, addI18n() {}, onState: [], onFold: [], rgbOf: () => [0, 0, 0] };
const ctx = { window: { PH }, document: { querySelector: () => null, querySelectorAll: () => [] }, requestAnimationFrame: () => 0, performance: { now: () => 0 }, ic: () => '' };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.argv[1], 'utf8'), ctx);
const f = { channels: ['pan', 'pan_fine', 'tilt', 'dimmer', 'shutter', 'red', 'green', 'blue', 'white', 'gobo', 'zoom', 'prism', 'sound', 'laser_r'],
  caps: { 11: [[10, 20, 'Prism', 'prism', null]], 12: [[128, 255, 'Sound', 'sound', null]] }, gobos: [[10, 'G1']], values: {}, overrides: {} };
console.log(JSON.stringify(PH.simpleFeatures(f)));
"""
        out = subprocess.run([node, "-e", script, str(ROOT / "static" / "simple.js")], capture_output=True, text=True, timeout=30)
        self.assertEqual(out.returncode, 0, out.stderr)
        F = json.loads(out.stdout)
        self.assertTrue(F["pt"] and F["rgb"] and F["dim"] and F["strobe"] and F["laser"])
        self.assertEqual(F["white"], [8])
        self.assertEqual(F["zoom"], 10)
        self.assertEqual(F["prism"][0], 11)
        self.assertEqual(F["sound"][0], 12)
        self.assertEqual(F["gobo"], [[10, "G1"]])


if __name__ == "__main__":
    unittest.main(verbosity=2)
