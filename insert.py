import re

def insert_product_details(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # The string to search for
    search_str = "<div><strong>Date:</strong> ${new Date(ret.returnDate || ret.date).toLocaleString('en-IN')}</div>"

    # The string to insert
    insert_str = """
                                               ${ret.description ? `<div><strong>Product:</strong> ${ret.description}</div>` : ''}
                                               ${ret.qty ? `<div><strong>Qty:</strong> ${ret.qty}</div>` : ''}
                                               ${ret.rate ? `<div><strong>Rate:</strong> &#8377;${Utils.formatCurrency(ret.rate)}</div>` : ''}"""

    # Replace the search_str with search_str + insert_str
    new_content = content.replace(search_str, search_str + insert_str)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

insert_product_details('js/invoice-history.js')
insert_product_details('js/purchase-history.js')
