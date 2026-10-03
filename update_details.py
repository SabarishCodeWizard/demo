import os
import re

directory = "js"

# 1. Replace the phone numbers in all js files
for filename in os.listdir(directory):
    if filename.endswith(".js"):
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace 90872 93268 with 90872 93268, 9092779599
        if '90872 93268' in content:
            # Prevent double replacement if script is run multiple times
            if '90872 93268, 9092779599' not in content:
                content = content.replace('90872 93268', '90872 93268, 9092779599')
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)

# 2. Increase watermark font size in pdf.js
pdf_js_path = os.path.join(directory, 'pdf.js')
if os.path.exists(pdf_js_path):
    with open(pdf_js_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace font-size: 75px; with font-size: 130px;
    if 'font-size: 75px;' in content:
        content = content.replace('font-size: 75px;', 'font-size: 130px;')
        with open(pdf_js_path, 'w', encoding='utf-8') as f:
            f.write(content)

# 3. Increase watermark image size in jsPDF generation (invoice-history.js, purchase-history.js)
for jsfile in ['invoice-history.js', 'purchase-history.js']:
    filepath = os.path.join(directory, jsfile)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace doc.addImage(logoBase64, 'JPEG', pageWidth / 2 - 40, pageHeight / 2 - 40, 80, 80);
        # With doc.addImage(logoBase64, 'JPEG', pageWidth / 2 - 60, pageHeight / 2 - 60, 120, 120);
        content = re.sub(
            r"doc\.addImage\(logoBase64,\s*'JPEG',\s*pageWidth\s*/\s*2\s*-\s*40,\s*pageHeight\s*/\s*2\s*-\s*40,\s*80,\s*80\);",
            "doc.addImage(logoBase64, 'JPEG', pageWidth / 2 - 75, pageHeight / 2 - 75, 150, 150);",
            content
        )
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

print("Updates completed successfully.")
