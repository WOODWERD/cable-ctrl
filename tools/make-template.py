#!/usr/bin/env python3
"""Writes site/cable-ctrl-template.xlsx (CC-R65). Run from the repo root when the template changes."""
import zipfile
from xml.sax.saxutils import escape

ROWS = [
    ["Line 1", "Line 2", "Type", "Quantity"],
    ["USB · DOCK", "Dock → Laptop", "USB", 2],
    ["ETH · DESK", "Router → Desk", "Ethernet", 2],
    ["PWR · DESK", "Strip → Monitor", "Power", 2],
]


def cell(col, row, value):
    ref = f"{'ABCD'[col]}{row}"
    if isinstance(value, int):
        return f'<c r="{ref}"><v>{value}</v></c>'
    return f'<c r="{ref}" t="inlineStr"><is><t>{escape(value)}</t></is></c>'


sheet = "".join(
    f'<row r="{r}">' + "".join(cell(c, r, v) for c, v in enumerate(row)) + "</row>"
    for r, row in enumerate(ROWS, 1)
)
HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
FILES = {
    "[Content_Types].xml": HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    "_rels/.rels": HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml": HEAD + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Labels" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": HEAD + f'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="2" width="28" customWidth="1"/></cols><sheetData>{sheet}</sheetData></worksheet>',
}

with zipfile.ZipFile("site/cable-ctrl-template.xlsx", "w", zipfile.ZIP_DEFLATED) as z:
    for name, text in FILES.items():
        z.writestr(name, text)
print("wrote site/cable-ctrl-template.xlsx")
