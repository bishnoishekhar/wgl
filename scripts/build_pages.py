#!/usr/bin/env python3
"""Stamp the chat/voice widget embed into every page.

Source of truth : assets/js/widget-embed.html  (HEAD-START..HEAD-END and BODY-START..BODY-END blocks)
Targets         : every *.html in the site root (index.html, pay-my-bill.html, 404.html, ...)

Each target page must contain the same marker pairs:
    <!-- @@HEAD-START ... -->  ...  <!-- @@HEAD-END -->     (inside <head>)
    <!-- @@BODY-START ... --> ...  <!-- @@BODY-END -->     (inside <div id="assistant-slot">)

Usage:
    python scripts/build_pages.py            # rewrite the blocks in every page
    python scripts/build_pages.py --check    # exit 1 if any page differs from the source (writes nothing)
Standard library only.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "js" / "widget-embed.html"


def block(text, name):
    m = re.search(r"<!-- @@%s-START[^\n]*-->\n(.*?)<!-- @@%s-END -->" % (name, name), text, re.S)
    if not m:
        sys.exit("ERROR: %s block not found in %s" % (name, SOURCE))
    return m.group(0)


def main():
    check = "--check" in sys.argv
    src = SOURCE.read_text(encoding="utf-8")
    new = {n: block(src, n) for n in ("HEAD", "BODY")}
    bad = 0
    for page in sorted(ROOT.glob("*.html")):
        txt = page.read_text(encoding="utf-8")
        out = txt
        for n in ("HEAD", "BODY"):
            pat = re.compile(r"<!-- @@%s-START[^\n]*-->\n.*?<!-- @@%s-END -->" % (n, n), re.S)
            if not pat.search(out):
                print("ERROR: %s has no %s markers" % (page.name, n))
                bad += 1
                break
            out = pat.sub(lambda _m, n=n: new[n], out, count=1)
        else:
            if out != txt:
                if check:
                    print("DIFFERS: %s" % page.name)
                    bad += 1
                else:
                    page.write_text(out, encoding="utf-8", newline="\n")
                    print("updated: %s" % page.name)
            else:
                print("ok:      %s" % page.name)
    if bad:
        sys.exit(1)


if __name__ == "__main__":
    main()
