---
name: docx
description: "Use this skill whenever the user wants to create, read, edit, or manipulate Word documents (.docx files). Triggers include: any mention of 'Word doc', 'word document', '.docx', or requests to produce professional documents with formatting."
license: Proprietary. LICENSE.txt has complete terms
---

# DOCX creation, editing, and analysis

## Quick Reference

| Task | Approach |
|------|----------|
| Read/analyze content | `pandoc` or unpack for raw XML |
| Create new document | Use `docx-js` (`npm install -g docx`) |
| Edit existing document | Unpack → edit XML → repack |

## Creating New Documents (docx-js)

```javascript
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, HeadingLevel, PageBreak, ImageRun } = require('docx');

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 24 } } }
  },
  sections: [{
    properties: {
      page: { size: { width: 12240, height: 15840 } } // US Letter
    },
    children: [
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Title")] }),
    ]
  }]
});
Packer.toBuffer(doc).then(buffer => fs.writeFileSync("doc.docx", buffer));
```

## Critical Rules
- Set page size explicitly (defaults to A4)
- Never use `\n` — use separate Paragraph elements
- Never use unicode bullets — use `LevelFormat.BULLET`
- Always use `WidthType.DXA` for table widths
- Tables need dual widths: `columnWidths` AND cell `width`
- Use `ShadingType.CLEAR` for table shading

## Editing Existing Documents
1. Unpack: `python scripts/office/unpack.py document.docx unpacked/`
2. Edit XML files in `unpacked/word/`
3. Repack: `python scripts/office/pack.py unpacked/ output.docx --original document.docx`
