#!/usr/bin/env python3
"""Validate the Food Aid Project static website."""

from __future__ import annotations

import re
import subprocess
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class SiteParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: set[str] = set()
        self.duplicates: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        element_id = dict(attrs).get("id")
        if element_id:
            if element_id in self.ids:
                self.duplicates.append(element_id)
            self.ids.add(element_id)


def main() -> int:
    failures: list[str] = []
    html_files = sorted(ROOT.glob("*.html"))

    for path in html_files:
        text = path.read_text(encoding="utf-8")
        parser = SiteParser()
        try:
            parser.feed(text)
            parser.close()
        except Exception as exc:
            failures.append(f"{path.name}: parser error: {exc}")

        for element_id in parser.duplicates:
            failures.append(f"{path.name}: duplicate id {element_id}")

        for term in ("<html", "</html>", "<title>", 'name="viewport"'):
            if term not in text.lower():
                failures.append(f"{path.name}: missing {term}")

        scripts = re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>", text, flags=re.I | re.S)
        for number, script in enumerate(scripts, start=1):
            if not script.strip():
                continue
            with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8", delete=False) as handle:
                handle.write(script)
                script_path = Path(handle.name)
            try:
                result = subprocess.run(["node", "--check", str(script_path)], capture_output=True, text=True)
                if result.returncode:
                    failures.append(f"{path.name}: script {number}: {result.stderr.strip()}")
            finally:
                script_path.unlink(missing_ok=True)

    required = {
        "index.html": ["/service-corps.html", "/privacy.html", "Skills for Food Security Service Corps"],
        "service-corps.html": ['id="intake-form"', 'id="consent-contact"', "info@foodaidproject.org", "/privacy.html"],
        "privacy.html": ["info@foodaidproject.org", "request correction or deletion"],
    }

    for filename, terms in required.items():
        path = ROOT / filename
        if not path.is_file():
            failures.append(f"missing required file: {filename}")
            continue
        text = path.read_text(encoding="utf-8")
        for term in terms:
            if term not in text:
                failures.append(f"{filename}: missing required term: {term}")

    print("Food Aid Project site validation")
    print(f"HTML files checked: {len(html_files)}")
    if failures:
        for failure in failures:
            print(f"- {failure}")
        print("Result: FAIL")
        return 1

    print("Result: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
