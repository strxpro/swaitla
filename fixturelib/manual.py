"""
Manuals, photos and product links -> a proposed channel chart (always shown to the user first).

* PDF: text is pulled out with a small built-in reader (Flate streams, Tj / TJ text operators) -
  no extra packages. Scanned PDFs (only pictures) have no text: the user types the table
  next to the page.
* Photo of the DMX table: Lumo has no OCR / AI module, so the photo is shown next to the
  editor and the user types the channels (the editor guesses the function from each name).
* Product link (AliExpress, Amazon, the maker): the page title is read and searched in the
  library; PDF links found on the page are offered as "read this manual".
"""

from __future__ import annotations

import html
import re
import urllib.request
import zlib
from typing import Any

from .adapters import _guess_type
from .model import Channel, Mode

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Lumo/4.5"


def pdf_text(data: bytes) -> str:
    """Best-effort text of a PDF (enough for DMX channel tables)."""
    out: list[str] = []
    for m in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", data, re.S):
        raw = m.group(1)
        for dec in (lambda b: zlib.decompress(b), lambda b: zlib.decompressobj().decompress(b), lambda b: b):
            try:
                s = dec(raw)
                break
            except Exception:
                continue
        else:
            continue
        if b"Tj" not in s and b"TJ" not in s:
            continue
        line: list[str] = []
        for tok in re.finditer(rb"\[(.*?)\]\s*TJ|\((.*?)(?<!\\)\)\s*Tj|(T\*|Td|TD|Tm|ET|')", s, re.S):
            if tok.group(3):
                if line:
                    out.append("".join(line))
                    line = []
                continue
            chunk = tok.group(1) if tok.group(1) is not None else tok.group(2)
            if tok.group(1) is not None:
                parts = re.findall(rb"\((.*?)(?<!\\)\)|(-?\d+\.?\d*)", chunk, re.S)
                txt = ""
                for p, num in parts:
                    if p:
                        txt += _pdf_str(p)
                    elif num and float(num) < -200:
                        txt += " "
                line.append(txt)
            else:
                line.append(_pdf_str(chunk))
        if line:
            out.append("".join(line))
    return "\n".join(x for x in out if x.strip())


def _pdf_str(b: bytes) -> str:
    b = re.sub(rb"\\([nrtbf()\\])", lambda m: {b"n": b"\n", b"r": b"", b"t": b" ", b"b": b"", b"f": b"",
                                              b"(": b"(", b")": b")", b"\\": b"\\"}[m.group(1)], b)
    b = re.sub(rb"\\(\d{1,3})", lambda m: bytes([int(m.group(1), 8) & 0xFF]), b)
    return b.decode("latin-1", "replace")


CH_LINE = re.compile(r"^\s*(?:ch(?:annel)?|kan(?:ał|al)?|canale)?\s*\.?\s*(\d{1,3})\s*[:.)\-–]?\s+([A-Za-zÀ-ž][^\n]{1,60})$", re.I)


def parse_chart(text: str) -> list[dict[str, Any]]:
    """Channel tables found in text: [{"name": "11CH", "channels": [{"name", "type"}...]}], longest first."""
    tables: list[list[tuple[int, str]]] = []
    cur: list[tuple[int, str]] = []
    for ln in text.splitlines():
        ln = ln.strip()
        m = CH_LINE.match(ln)
        if m:
            n, name = int(m.group(1)), m.group(2).strip()
            name = re.split(r"\s{2,}|\s\d{1,3}\s*[-–~]\s*\d{1,3}", name)[0].strip(" .:-")
            if cur and n == cur[-1][0] + 1:
                cur.append((n, name))
                continue
            if cur and len(cur) >= 3:
                tables.append(cur)
            cur = [(n, name)] if n == 1 else []
    if len(cur) >= 3:
        tables.append(cur)
    seen, out = set(), []
    for tb in sorted(tables, key=len, reverse=True):
        sig = tuple(x[1].lower() for x in tb)
        if sig in seen:
            continue
        seen.add(sig)
        out.append({"name": f"{len(tb)}CH", "channels": [{"name": nm, "type": _guess_type(nm).value} for _, nm in tb]})
    return out[:6]


def chart_to_mode(chart: dict[str, Any]) -> Mode:
    from .model import ChannelType
    chans = []
    for i, c in enumerate(chart.get("channels") or []):
        try:
            ct = ChannelType(c.get("type") or _guess_type(c.get("name", "")).value)
        except ValueError:
            ct = ChannelType.Unknown
        chans.append(Channel(i, c.get("name", f"CH{i + 1}"), ct))
    return Mode(chart.get("name") or f"{len(chans)}CH", chans)


def fetch(url: str, limit: int = 8_000_000, timeout: float = 12) -> tuple[bytes, str]:
    if not re.match(r"^https?://", url):
        raise ValueError("link musi zaczynać się od http:// albo https://")
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en,pl;q=0.8"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(limit), r.headers.get("Content-Type", "")


def product_info(url: str) -> dict[str, Any]:
    """Name of the product behind a shop / maker link + PDF manuals linked from the page."""
    data, ctype = fetch(url, 3_000_000)
    if "pdf" in ctype or data[:4] == b"%PDF":
        text = pdf_text(data)
        return {"title": "", "pdfs": [url], "charts": parse_chart(text), "text": text[:4000]}
    page = data.decode("utf-8", "replace")
    title = ""
    for pat in (r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)', r"<title[^>]*>(.*?)</title>",
                r'"subject"\s*:\s*"([^"]{5,200})"', r'"productTitle"\s*:\s*"([^"]{5,200})"'):
        m = re.search(pat, page, re.I | re.S)
        if m:
            title = html.unescape(re.sub(r"\s+", " ", m.group(1))).strip()
            break
    title = re.sub(r"\s*[-|–]\s*(AliExpress|Amazon\S*|eBay|Allegro).*$", "", title, flags=re.I)
    pdfs = sorted({html.unescape(u) for u in re.findall(r'href=["\']([^"\']+\.pdf[^"\']*)', page, re.I)})[:8]
    pdfs = [u if u.startswith("http") else urllib.request.urljoin(url, u) for u in pdfs]
    return {"title": title[:200], "pdfs": pdfs, "charts": parse_chart(re.sub(r"<[^>]+>", "\n", page)), "text": ""}


def search_words(title: str) -> str:
    """Shop titles are long ("2PCS 60W Mini LED Moving Head Spot Gobo DMX512 Stage Light DJ Disco ...") - keep the useful words."""
    t = re.sub(r"\b\d+\s*(pcs|pc|lot|set|x)\b", " ", title, flags=re.I)
    t = re.sub(r"\b(dmx ?512|dj|disco|party|club|bar|ktv|wedding|stage|light(ing)?|lamp|effect|professional|new|hot|sale|free|shipping|for|with|and)\b",
               " ", t, flags=re.I)
    words = [w for w in re.split(r"[^\w\-]+", t) if len(w) > 1][:8]
    return " ".join(words)
