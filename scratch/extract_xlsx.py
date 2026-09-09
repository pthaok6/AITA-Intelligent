import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET


NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = {"r": "http://schemas.openxmlformats.org/package/2006/relationships"}
DOC_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def col_index(ref):
    letters = re.match(r"[A-Z]+", ref).group(0)
    value = 0
    for ch in letters:
        value = value * 26 + ord(ch) - 64
    return value - 1


path = sys.argv[1]
sys.stdout.reconfigure(encoding="utf-8")
with zipfile.ZipFile(path) as archive:
    shared = []
    if "xl/sharedStrings.xml" in archive.namelist():
        root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
        for si in root.findall("m:si", NS):
            shared.append("".join(t.text or "" for t in si.iterfind(".//m:t", NS)))

    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels.findall("r:Relationship", REL_NS)}

    for sheet in workbook.find("m:sheets", NS):
        name = sheet.attrib["name"]
        target = targets[sheet.attrib[DOC_REL]].replace("\\", "/")
        if target.startswith("/"):
            entry = target.lstrip("/")
        elif target.startswith("xl/"):
            entry = target
        else:
            entry = "xl/" + target.lstrip("/")
        root = ET.fromstring(archive.read(entry))
        rows = []
        max_col = -1
        for row in root.findall(".//m:sheetData/m:row", NS):
            out = {}
            for cell in row.findall("m:c", NS):
                ref = cell.attrib["r"]
                idx = col_index(ref)
                max_col = max(max_col, idx)
                cell_type = cell.attrib.get("t")
                value_node = cell.find("m:v", NS)
                inline = cell.find("m:is", NS)
                if cell_type == "s" and value_node is not None:
                    value = shared[int(value_node.text)]
                elif cell_type == "inlineStr" and inline is not None:
                    value = "".join(t.text or "" for t in inline.iterfind(".//m:t", NS))
                elif value_node is not None:
                    value = value_node.text or ""
                else:
                    value = ""
                if value != "":
                    out[idx] = value
            if out:
                rows.append({"row": int(row.attrib["r"]), "cells": out})
        print(json.dumps({"sheet": name, "max_col": max_col, "rows": rows}, ensure_ascii=False))
