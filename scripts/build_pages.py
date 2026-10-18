#!/usr/bin/env python3
"""Stamp the shared blocks into every page.

Sources of truth
  assets/js/widget-embed.html  HEAD and BODY blocks  (chat/voice widget snippet, stamped byte-identically)
  scripts/chrome.html          UTIL, NAV and FOOT blocks (utility-bar links, main navigation, footer)
Targets
  every *.html in the site root (index.html, pay-my-bill.html, 404.html, ...) except SKIP_PAGES (widget-preview.html)

Each target page must contain the same marker pairs:
    <!-- @@HEAD-START ... -->  ...  <!-- @@HEAD-END -->     (inside <head>)
    <!-- @@UTIL-START ... --> ...  <!-- @@UTIL-END -->     (utility bar, right-hand links)
    <!-- @@NAV-START ... -->  ...  <!-- @@NAV-END -->      (main navigation list items)
    <!-- @@FOOT-START ... --> ...  <!-- @@FOOT-END -->     (footer columns)
    <!-- @@BODY-START ... --> ...  <!-- @@BODY-END -->     (inside <div id="assistant-slot">)

The NAV block is stamped with aria-current="page" on the menu button of the section the page belongs to.
The section comes from <body data-page-context="..."> (see MENU_FOR_CONTEXT below).

Usage:
    python scripts/build_pages.py            # rewrite the blocks in every page
    python scripts/build_pages.py --check    # exit 1 if any page differs from the sources (writes nothing)
Standard library only.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
WIDGET_SRC = ROOT / "assets" / "js" / "widget-embed.html"
CHROME_SRC = ROOT / "scripts" / "chrome.html"
# review-only pages that are not part of the site (no chrome, no widget snippet)
SKIP_PAGES = {"widget-preview.html"}

# data-page-context value -> id of the mega menu whose button gets aria-current="page"
MENU_FOR_CONTEXT = {
    "home": None,
    "billing": "mega-billing",
    "service": "mega-residential",
    "choice": "mega-residential",
    "claims": "mega-residential",
    "business": "mega-business",
    "assistance": "mega-assistance",
    "contact": "mega-assistance",
    "safety": "mega-safety",
    "savings": "mega-save",
    "energy": "mega-save",
    "spanish": None,
    "notfound": None,
}


def block(text, name, source):
    m = re.search(r"<!-- @@%s-START[^\n]*-->\n(.*?)<!-- @@%s-END -->" % (name, name), text, re.S)
    if not m:
        sys.exit("ERROR: %s block not found in %s" % (name, source))
    return m.group(0)


def page_context(txt):
    m = re.search(r'<body[^>]*\sdata-page-context="([a-z]+)"', txt)
    return m.group(1) if m else None


def with_current(nav, ctx):
    menu = MENU_FOR_CONTEXT.get(ctx)
    if not menu:
        return nav
    needle = 'aria-controls="%s"' % menu
    return nav.replace(needle, needle + ' aria-current="page"', 1)


def main():
    check = "--check" in sys.argv
    widget = WIDGET_SRC.read_text(encoding="utf-8")
    chrome = CHROME_SRC.read_text(encoding="utf-8")
    new = {n: block(widget, n, WIDGET_SRC) for n in ("HEAD", "BODY")}
    new.update({n: block(chrome, n, CHROME_SRC) for n in ("UTIL", "NAV", "FOOT")})
    bad = 0
    for page in sorted(ROOT.glob("*.html")):
        if page.name in SKIP_PAGES:
            continue
        txt = page.read_text(encoding="utf-8")
        ctx = page_context(txt)
        if ctx is None:
            print("ERROR: %s has no data-page-context on <body>" % page.name)
            bad += 1
            continue
        if ctx not in MENU_FOR_CONTEXT:
            print("ERROR: %s has unknown data-page-context %r" % (page.name, ctx))
            bad += 1
            continue
        out = txt
        ok = True
        for n in ("HEAD", "UTIL", "NAV", "FOOT", "BODY"):
            pat = re.compile(r"<!-- @@%s-START[^\n]*-->\n.*?<!-- @@%s-END -->" % (n, n), re.S)
            if not pat.search(out):
                print("ERROR: %s has no %s markers" % (page.name, n))
                bad += 1
                ok = False
                break
            repl = with_current(new[n], ctx) if n == "NAV" else new[n]
            out = pat.sub(lambda _m, repl=repl: repl, out, count=1)
        if not ok:
            continue
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
