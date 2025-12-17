from .models import Category

# Keyword-based categorization rules
CATEGORIZATION_RULES = {
    # INCOME categories
    "Salary": {
        "type": "INCOME",
        "keywords": ["salary", "paycheck", "wages", "income", "pay"]
    },
    "Freelance": {
        "type": "INCOME",
        "keywords": ["freelance", "contract", "gig", "consulting", "side hustle"]
    },
    
    # EXPENSE categories
    "Food & Dining": {
        "type": "EXPENSE",
        "keywords": [
            "restaurant", "cafe", "coffee", "starbucks", "chipotle", 
            "mcdonalds", "pizza", "lunch", "dinner", "breakfast",
            "doordash", "ubereats", "grubhub", "food", "meal"
        ]
    },
    "Groceries": {
        "type": "EXPENSE",
        "keywords": [
            "walmart", "target", "whole foods", "trader joe", "costco",
            "grocery", "market", "safeway", "kroger", "supermarket"
        ]
    },
    "Transportation": {
        "type": "EXPENSE",
        "keywords": [
            "uber", "lyft", "gas", "shell", "chevron", "metro", 
            "transit", "parking", "toll", "taxi", "bus", "train"
        ]
    },
    "Entertainment": {
        "type": "EXPENSE",
        "keywords": [
            "netflix", "spotify", "hulu", "movie", "cinema", "amc",
            "concert", "ticket", "game", "theater", "show"
        ]
    },
    "Shopping": {
        "type": "EXPENSE",
        "keywords": [
            "amazon", "ebay", "mall", "clothing", "shoes", "store",
            "online", "shop"
        ]
    },
    "Bills & Utilities": {
        "type": "EXPENSE",
        "keywords": [
            "electric", "water", "internet", "phone", "verizon", 
            "at&t", "comcast", "utility", "bill", "rent"
        ]
    },
}

def auto_categorize_transaction(note, user):
    """
    Attempts to categorize based on note/description.
    Returns category object or None.
    """
    if not note:
        return None
    
    note_lower = note.lower()
    
    # Check against keyword rules
    for category_name, config in CATEGORIZATION_RULES.items():
        keywords = config["keywords"]
        category_type = config["type"]
        
        for keyword in keywords:
            if keyword in note_lower:
                try:
                    # Find matching category for this user with correct type
                    return Category.objects.filter(
                        owner=user,
                        name__icontains=category_name.split('&')[0].strip(),
                        type=category_type
                    ).first()
                except Category.DoesNotExist:
                    continue
    
    return None


def get_default_category(user, transaction_type="EXPENSE"):
    """
    Gets the default "Other" category for user.
    Creates it if it doesn't exist.
    """
    category_name = "Other Expenses" if transaction_type == "EXPENSE" else "Other Income"
    
    category, created = Category.objects.get_or_create(
        owner=user,
        name=category_name,
        defaults={"type": transaction_type}
    )
    return category