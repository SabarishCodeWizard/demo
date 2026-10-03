import re

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # The broken string we introduced
    broken_str = r"<div><strong>Date:</strong> ${new Date(ret.returnDate || ret.date).toLocaleString('en-IN')}</div>${ret.description ? `<div><strong>Product:</strong> ${ret.description}</div>` : '}${ret.qty ? `<div><strong>Qty:</strong> ${ret.qty}</div>` : '}${ret.rate ? `<div><strong>Rate:</strong> &#8377;${Utils.formatCurrency(ret.rate)}</div>` : '}<div style=\"color: #dc3545; font-weight: bold;\"><strong>Amount:</strong> -&#8377;${Utils.formatCurrency(ret.returnAmount)}</div><div><strong>Reason:</strong> ${ret.reason || 'N/A'}</div>"

    # The fixed string we want
    fixed_str = """<div><strong>Date:</strong> ${new Date(ret.returnDate || ret.date).toLocaleString('en-IN')}</div>
                                               ${ret.description ? `<div><strong>Product:</strong> ${ret.description}</div>` : ''}
                                               ${ret.qty ? `<div><strong>Qty:</strong> ${ret.qty}</div>` : ''}
                                               ${ret.rate ? `<div><strong>Rate:</strong> &#8377;${Utils.formatCurrency(ret.rate)}</div>` : ''}
                                               <div style=\"color: #dc3545; font-weight: bold;\"><strong>Amount:</strong> -&#8377;${Utils.formatCurrency(ret.returnAmount)}</div>
                                               <div><strong>Reason:</strong> ${ret.reason || 'N/A'}</div>"""

    content = content.replace(broken_str, fixed_str)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

fix_file('js/invoice-history.js')
fix_file('js/purchase-history.js')
