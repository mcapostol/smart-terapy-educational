#!/usr/bin/env python3
"""Extract public Instagram profile metadata from a saved HTML response.

The parser intentionally uses only Open Graph and description metadata that is
present in the public document. It does not call private Instagram APIs.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import tempfile
from datetime import datetime, timezone
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse


class MetaParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.meta: list[dict[str, str]] = []
        self.canonical_url: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key.lower(): value or "" for key, value in attrs}
        if tag.lower() == "meta":
            self.meta.append(values)
        elif tag.lower() == "link" and values.get("rel") == "canonical":
            self.canonical_url = values.get("href")

    def content(self, key: str) -> str | None:
        for item in self.meta:
            if item.get("property") == key or item.get("name") == key:
                return item.get("content")
        return None


def required(value: str | None, label: str) -> str:
    if not value:
        raise ValueError(f"Missing public metadata: {label}")
    return value


def clean_bio(description: str) -> str:
    marker = " on Instagram: "
    if marker not in description:
        raise ValueError("Instagram description does not contain a public biography")
    bio = description.split(marker, 1)[1].strip()
    if len(bio) >= 2 and bio[0] == bio[-1] == '"':
        bio = bio[1:-1]
    return bio.strip()


def parse_counts(description: str) -> dict[str, int]:
    match = re.search(
        r"(?P<followers>[\d,.]+) Followers, "
        r"(?P<following>[\d,.]+) Following, "
        r"(?P<posts>[\d,.]+) Posts",
        description,
    )
    if not match:
        raise ValueError("Instagram description does not contain public profile counts")
    return {key: int(value.replace(",", "").replace(".", "")) for key, value in match.groupdict().items()}


def download_image(url: str, destination: Path) -> None:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; SmartTerapySite/1.0)",
            "Accept": "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8",
        },
    )
    destination.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(request, timeout=30) as response:
        content_type = response.headers.get_content_type()
        if content_type not in {"image/jpeg", "image/png", "image/webp", "image/avif"}:
            raise ValueError(f"Expected an image, received {content_type}")
        data = response.read()
    if len(data) < 1_000:
        raise ValueError("Downloaded profile image is unexpectedly small")
    with tempfile.NamedTemporaryFile(dir=destination.parent, delete=False) as temporary:
        temporary.write(data)
        temporary_path = Path(temporary.name)
    temporary_path.replace(destination)


def extract(html_path: Path, asset_path: Path) -> dict[str, object]:
    parser = MetaParser()
    parser.feed(html_path.read_text(encoding="utf-8"))

    title = required(parser.content("og:title"), "og:title")
    profile_url = required(parser.content("og:url") or parser.canonical_url, "og:url")
    image_url = required(parser.content("og:image"), "og:image")
    description = required(parser.content("description"), "description")
    name = title.split(" (@", 1)[0].strip()
    username = urlparse(profile_url).path.strip("/").split("/")[0]
    if not username:
        raise ValueError("Could not determine the Instagram username")

    return {
        "captured_at_utc": datetime.now(timezone.utc).isoformat(),
        "name": name,
        "username": username,
        "profile_url": profile_url,
        "bio": clean_bio(description),
        "counts": parse_counts(description),
        "profile_image": {
            "source_url": image_url,
            "local_path": f"/{asset_path.as_posix().lstrip('/')}",
        },
        "gallery": [],
        "gallery_note": "Pagina publică furnizată nu expune imagini ale postărilor în HTML fără autentificare.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("html", type=Path, help="Saved public Instagram profile HTML")
    parser.add_argument("--output", type=Path, required=True, help="Destination JSON file")
    parser.add_argument(
        "--asset",
        type=Path,
        default=Path("public/assets/instagram-profile.jpg"),
        help="Profile image destination",
    )
    parser.add_argument("--skip-download", action="store_true", help="Only parse metadata")
    args = parser.parse_args()

    try:
        result = extract(args.html, args.asset)
        if not args.skip_download:
            source_url = str(result["profile_image"]["source_url"])  # type: ignore[index]
            download_image(source_url, args.asset)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except (OSError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
