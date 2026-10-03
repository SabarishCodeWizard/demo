import re

def remove_undo_all_buttons(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Match any button that calls undoAllPayments or undoAllReturns
    content = re.sub(
        r'<button[^>]*onclick="undoAll(?:Payments|Returns)[^>]*>[\s\S]*?</button>',
        '',
        content
    )
    
    # Also remove any leftover empty divs that previously wrapped the buttons in the history lists
    content = re.sub(
        r'<div style="margin-top: 10px;">\s*</div>',
        '',
        content
    )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

remove_undo_all_buttons('js/invoice-history.js')
remove_undo_all_buttons('js/purchase-history.js')
