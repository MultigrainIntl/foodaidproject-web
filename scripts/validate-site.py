#!/usr/bin/env python3
"""Validate the Food Aid Project static website and intake source."""

from __future__ import annotations

import re
import subprocess
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APPROVED_SERVICE_CORPS_ENDPOINT = (
    "https://script.google.com/macros/s/"
    "AKfycbzVIx_2Qc0w9f4ch7b3uo-n8Krs86r4_DAAT8CPhwkfCGpsA3WryOApucfUp9n9eqou/exec"
)


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


def check_javascript(source: str, label: str, failures: list[str]) -> None:
    if not source.strip():
        return
    with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8", delete=False) as handle:
        handle.write(source)
        script_path = Path(handle.name)
    try:
        result = subprocess.run(["node", "--check", str(script_path)], capture_output=True, text=True)
        if result.returncode:
            failures.append(f"{label}: {result.stderr.strip()}")
    finally:
        script_path.unlink(missing_ok=True)


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
            check_javascript(script, f"{path.name}: inline script {number}", failures)

    required = {
        "index.html": ["service-corps.html", "privacy.html", "Skills for Food Security Service Corps"],
        "service-corps.html": [
            'id="intake-form"',
            'name="serviceFormat" value="Remote"',
            'id="outreach-section"',
            "Outreach, social media, digital content, or influencer ambassador",
            "Food Aid Project does not currently manage in-person volunteer programs",
            "info@foodaidproject.org",
            "privacy.html",
            "service-corps-config.js",
        ],
        "privacy.html": ["info@foodaidproject.org", "request correction or deletion"],
        "service-corps-config.js": ["endpoint:", "responseOrigins"],
        "apps-script/service-corps-network/Code.gs": [
            "Service Corps Network",
            "Intake",
            "FollowUp",
            "Opportunities",
            "JoieOS Queue",
            "sendAcknowledgment_",
            "sendReviewReminders",
            "Relationships and Audiences",
            "Outreach Platforms",
            "publicProfile",
            "appendMappedRow_",
            "SCHEMA_MISMATCH_",
        ],
        "apps-script/service-corps-network/appsscript.json": [
            "ANYONE_ANONYMOUS",
            "USER_DEPLOYING",
            "https://www.googleapis.com/auth/userinfo.email",
        ],
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

    service_corps = (ROOT / "service-corps.html").read_text(encoding="utf-8")
    forbidden = [
        "Either remote or in person",
        "Hands-on distribution, events, facilities, or field work",
        "Agriculture, food, farming, or processing",
    ]
    for term in forbidden:
        if term in service_corps:
            failures.append(f"service-corps.html: forbidden legacy option remains: {term}")

    config = (ROOT / "service-corps-config.js").read_text(encoding="utf-8")
    endpoint_match = re.search(r"endpoint:\s*['\"]([^'\"]*)['\"]", config)
    if not endpoint_match:
        failures.append("service-corps-config.js: endpoint setting is missing")
    elif endpoint_match.group(1) not in ("", APPROVED_SERVICE_CORPS_ENDPOINT):
        failures.append("service-corps-config.js: endpoint is not the approved Service Corps deployment")

    if "outreachAdapted" in config:
        failures.append("service-corps-config.js: legacy outreach compatibility adapter must be removed")

    apps_script = ROOT / "apps-script/service-corps-network/Code.gs"
    if apps_script.is_file():
        check_javascript(apps_script.read_text(encoding="utf-8"), "Code.gs syntax", failures)

    schema_test = ROOT / "scripts/validate-service-corps-schema.js"
    if not schema_test.is_file():
        failures.append("missing required file: scripts/validate-service-corps-schema.js")
    else:
        result = subprocess.run(["node", str(schema_test)], capture_output=True, text=True)
        if result.returncode:
            failures.append(f"Service Corps schema mapping: {result.stderr.strip() or result.stdout.strip()}")

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
