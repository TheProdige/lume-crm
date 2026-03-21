---
name: pdf
description: Use this skill whenever the user wants to do anything with PDF files. This includes reading, extracting text/tables, combining, splitting, rotating, adding watermarks, creating new PDFs, filling forms, encrypting/decrypting, extracting images, and OCR on scanned PDFs.
license: Proprietary. LICENSE.txt has complete terms
---

# PDF Processing Guide

## Quick Start

```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("document.pdf")
text = ""
for page in reader.pages:
    text += page.extract_text()
```

## Libraries

| Task | Best Tool |
|------|-----------|
| Merge PDFs | pypdf |
| Split PDFs | pypdf |
| Extract text | pdfplumber |
| Extract tables | pdfplumber |
| Create PDFs | reportlab |
| OCR scanned PDFs | pytesseract |
| Fill PDF forms | pdf-lib or pypdf |

## Common Operations

### Extract Tables
```python
import pdfplumber
with pdfplumber.open("document.pdf") as pdf:
    for page in pdf.pages:
        tables = page.extract_tables()
```

### Merge PDFs
```python
writer = PdfWriter()
for pdf_file in ["doc1.pdf", "doc2.pdf"]:
    reader = PdfReader(pdf_file)
    for page in reader.pages:
        writer.add_page(page)
with open("merged.pdf", "wb") as output:
    writer.write(output)
```

### Create PDFs (reportlab)
```python
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
c = canvas.Canvas("hello.pdf", pagesize=letter)
c.drawString(100, 700, "Hello World!")
c.save()
```

### Command Line
```bash
pdftotext -layout input.pdf output.txt  # Extract text
qpdf --empty --pages file1.pdf file2.pdf -- merged.pdf  # Merge
```
