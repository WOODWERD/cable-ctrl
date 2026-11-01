#!/usr/bin/env python3
"""Fills the shared strip, theme switch, footer and mark into site/index.html and site/guide.html.
Run from the repo root after changing tools/*.html. site/ is plain files, so Pages needs no build."""
import re

parts = re.split(r"<!--(STRIP|THEME|FOOTER)-->\n", open("tools/chrome.html.txt", encoding="utf8").read())
blocks = {parts[i]: parts[i + 1].rstrip() for i in range(1, len(parts), 2)}
mark = open("tools/mark.svg.txt", encoding="utf8").read()
mark = re.sub(r"\s*\n\s*", "", mark).replace('class="wwmark"', 'class="wwmark" aria-hidden="true"').replace(' role="img" aria-label="WOODWERD Design"', "")

for src, out in (("tools/index.src.html", "site/index.html"), ("tools/guide.src.html", "site/guide.html")):
    html = open(src, encoding="utf8").read()
    for name, block in blocks.items():
        html = html.replace(f"<!--{name}-->", block)
    open(out, "w", encoding="utf8").write(html.replace("<!--MARK-->", mark))
print("wrote site/index.html and site/guide.html")
