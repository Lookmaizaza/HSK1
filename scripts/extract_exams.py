import pdfplumber
import json
import os

pdf_files = ['H10901.pdf', 'H20901.pdf', 'H31001.pdf']

for pdf_file in pdf_files:
    print(f"=== {pdf_file} ===")
    with pdfplumber.open(pdf_file) as pdf:
        print(f"Total pages: {len(pdf.pages)}")
        full_text = ""
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            print(f"Page {i+1}: length {len(text)}")
            full_text += f"\n--- Page {i+1} ---\n" + text
        
        # Save to scratch
        out_txt = f"scratch_{pdf_file.replace('.pdf', '')}.txt"
        with open(out_txt, "w", encoding="utf-8") as f:
            f.write(full_text)
        print(f"Saved to {out_txt}")
