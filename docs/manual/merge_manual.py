# -*- coding: utf-8 -*-
"""Render the cover (template 01) and merge it as page 1 of the manual body."""
import json
import os
import sys

PDF_SKILL_DIR = r"C:\Users\gagan\.zcode\cli\plugins\cache\zcode-plugins-official\document-skills\0.1.4\skills\pdf"
sys.path.insert(0, os.path.join(PDF_SKILL_DIR, "scripts"))

from cover_render import render_cover, detect_fonts  # noqa: E402
from pypdf import PdfReader, PdfWriter, Transformation  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
A4_W, A4_H = 595.28, 841.89

content = json.load(open(os.path.join(HERE, 'cover_content.json'), encoding='utf-8'))
palette = {
    "primary": "#23748f",
    "secondary": "#776b46",
    "text": "#171715",
    "muted": "#908d86",
    "bg": "#ffffff",
}

fonts = detect_fonts()
render_cover("01", content, os.path.join(HERE, "cover.pdf"), palette=palette, fonts=fonts)
print("COVER OK")


def normalize_page_to_a4(page):
    box = page.mediabox
    w, h = float(box.width), float(box.height)
    if abs(w - A4_W) > 2 or abs(h - A4_H) > 2:
        sx, sy = A4_W / w, A4_H / h
        page.add_transformation(Transformation().scale(sx=sx, sy=sy))
        page.mediabox.lower_left = (0, 0)
        page.mediabox.upper_right = (A4_W, A4_H)
    return page


writer = PdfWriter()
writer.add_page(normalize_page_to_a4(PdfReader(os.path.join(HERE, 'cover.pdf')).pages[0]))
for page in PdfReader(os.path.join(HERE, 'manual_body.pdf')).pages:
    writer.add_page(normalize_page_to_a4(page))
writer.add_metadata({
    '/Title': 'BSC Enterprise Operations Platform - Complete User Manual',
    '/Author': 'Z.ai',
    '/Creator': 'Z.ai',
    '/Subject': 'User manual: Wedding CRM, Store Operations, Recruitment, Administration',
})
FINAL = r"D:\bssc\BSC_SMG\BSC_SMG_CRM\BSC_Complete_User_Manual.pdf"
with open(FINAL, 'wb') as f:
    writer.write(f)
print('FINAL OK:', FINAL, '- pages:', len(writer.pages))
