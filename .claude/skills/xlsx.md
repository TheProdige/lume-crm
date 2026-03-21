---
name: xlsx
description: "Use this skill any time a spreadsheet file is the primary input or output. This means any task where the user wants to: open, read, edit, or fix an existing .xlsx, .xlsm, .csv, or .tsv file; create a new spreadsheet from scratch or from other data sources; or convert between tabular file formats."
license: Proprietary. LICENSE.txt has complete terms
---

# XLSX creation, editing, and analysis

## Reading and analyzing data

### Data analysis with pandas
```python
import pandas as pd

df = pd.read_excel('file.xlsx')
all_sheets = pd.read_excel('file.xlsx', sheet_name=None)
df.head(); df.info(); df.describe()
df.to_excel('output.xlsx', index=False)
```

## Creating Excel files with openpyxl

```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

wb = Workbook()
sheet = wb.active
sheet['A1'] = 'Hello'
sheet['B2'] = '=SUM(A1:A10)'
sheet['A1'].font = Font(bold=True, color='FF0000')
sheet.column_dimensions['A'].width = 20
wb.save('output.xlsx')
```

## Editing existing files

```python
from openpyxl import load_workbook
wb = load_workbook('existing.xlsx')
sheet = wb.active
sheet['A1'] = 'New Value'
wb.save('modified.xlsx')
```

## Critical Rules

- **Always use Excel formulas** instead of hardcoding calculated values
- Use `WidthType.DXA` for table widths (never percentages)
- Use `ShadingType.CLEAR` for table shading (never SOLID)
- Cell indices are 1-based
- Use `data_only=True` to read calculated values (warning: saves will lose formulas)

## Financial Models Color Coding
- **Blue text**: Hardcoded inputs
- **Black text**: Formulas and calculations
- **Green text**: Cross-sheet links
- **Red text**: External links
- **Yellow background**: Key assumptions
