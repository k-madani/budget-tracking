"""
Common validation utilities for the Budgetly API.
Place this in a new file: budgetapi/utils/validators.py
"""

import uuid as uuid_lib
import re
from decimal import Decimal, InvalidOperation
from datetime import datetime, timedelta
from django.utils import timezone
from django.core.exceptions import ValidationError
from typing import Optional, Tuple


def validate_uuid(uuid_string: str) -> Tuple[bool, Optional[str]]:
    """
    Validate UUID format.
    
    Args:
        uuid_string: String to validate as UUID
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        uuid_lib.UUID(str(uuid_string))
        return True, None
    except (ValueError, AttributeError, TypeError):
        return False, "Invalid UUID format"


def validate_amount(amount: any) -> Tuple[bool, Optional[str]]:
    """
    Validate transaction/budget amount.
    
    Args:
        amount: Amount to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        decimal_amount = Decimal(str(amount))
    except (InvalidOperation, ValueError, TypeError):
        return False, "Invalid amount format"
    
    if decimal_amount <= 0:
        return False, "Amount must be positive"
    
    if decimal_amount > Decimal('9999999.99'):
        return False, "Amount exceeds maximum allowed value (9,999,999.99)"
    
    # Check decimal places
    if decimal_amount.as_tuple().exponent < -2:
        return False, "Amount cannot have more than 2 decimal places"
    
    return True, None


def validate_currency_code(currency: str) -> Tuple[bool, Optional[str]]:
    """
    Validate currency code.
    
    Args:
        currency: Currency code to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not currency:
        return True, None  # Will default to USD
    
    currency = currency.upper().strip()
    
    if len(currency) != 3:
        return False, "Currency must be a 3-letter code (e.g., USD, EUR)"
    
    if not currency.isalpha():
        return False, "Currency code must contain only letters"
    
    # List of supported currencies
    supported_currencies = {
        'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'BRL',
        'MXN', 'ZAR', 'SGD', 'HKD', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'THB',
        'IDR', 'MYR', 'PHP', 'CZK', 'ILS', 'CLP', 'TRY', 'AED', 'SAR', 'KRW'
    }
    
    if currency not in supported_currencies:
        return False, f"Unsupported currency code. Supported: {', '.join(list(supported_currencies)[:10])}..."
    
    return True, None


def validate_date(date_str: str, field_name: str = "date") -> Tuple[bool, Optional[str]]:
    """
    Validate date string format (YYYY-MM-DD).
    
    Args:
        date_str: Date string to validate
        field_name: Name of the field for error messages
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not date_str:
        return False, f"{field_name} is required"
    
    # Try to parse the date
    try:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return False, f"Invalid {field_name} format. Use YYYY-MM-DD"
    
    # Check if date is too far in the past
    min_date = datetime(2000, 1, 1).date()
    if date_obj < min_date:
        return False, f"{field_name} is too far in the past"
    
    # Check if date is too far in the future
    max_date = (timezone.now() + timedelta(days=365)).date()
    if date_obj > max_date:
        return False, f"{field_name} cannot be more than a year in the future"
    
    return True, None


def validate_datetime(datetime_str: str, field_name: str = "datetime") -> Tuple[bool, Optional[str]]:
    """
    Validate datetime string (ISO format).
    
    Args:
        datetime_str: Datetime string to validate
        field_name: Name of the field for error messages
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not datetime_str:
        return False, f"{field_name} is required"
    
    try:
        from django.utils.dateparse import parse_datetime, parse_date
        
        dt = parse_datetime(datetime_str)
        if not dt:
            # Try parsing as date only
            d = parse_date(datetime_str)
            if d:
                dt = timezone.make_aware(datetime.combine(d, datetime.min.time()))
        
        if not dt:
            return False, f"Invalid {field_name} format. Use ISO format (YYYY-MM-DDTHH:MM:SS)"
        
        # Ensure timezone awareness
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt)
        
        # Validate not too far in the future
        max_future = timezone.now() + timedelta(days=7)
        if dt > max_future:
            return False, f"{field_name} cannot be more than 7 days in the future"
        
        # Validate not too far in the past
        min_past = timezone.make_aware(datetime(2000, 1, 1))
        if dt < min_past:
            return False, f"{field_name} is too far in the past"
        
        return True, None
        
    except (ValueError, TypeError) as e:
        return False, f"Invalid {field_name} format: {str(e)}"


def validate_email(email: str) -> Tuple[bool, Optional[str]]:
    """
    Validate email format.
    
    Args:
        email: Email address to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not email:
        return False, "Email is required"
    
    email = email.strip().lower()
    
    # Basic email regex
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_regex, email):
        return False, "Enter a valid email address"
    
    # Check for blocked domains (optional)
    blocked_domains = ['tempmail.com', '10minutemail.com', 'guerrillamail.com']
    domain = email.split('@')[1]
    if domain in blocked_domains:
        return False, "Temporary email addresses are not allowed"
    
    return True, None


def validate_username(username: str) -> Tuple[bool, Optional[str]]:
    """
    Validate username.
    
    Args:
        username: Username to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not username:
        return False, "Username is required"
    
    username = username.strip()
    
    if len(username) < 3:
        return False, "Username must be at least 3 characters long"
    
    if len(username) > 150:
        return False, "Username cannot exceed 150 characters"
    
    # Check for valid characters (alphanumeric, underscore, hyphen, period)
    if not re.match(r'^[\w.-]+$', username):
        return False, "Username can only contain letters, numbers, underscores, hyphens, and periods"
    
    # Check if starts with valid character
    if not username[0].isalnum():
        return False, "Username must start with a letter or number"
    
    return True, None


def validate_category_name(name: str) -> Tuple[bool, Optional[str]]:
    """
    Validate category name.
    
    Args:
        name: Category name to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not name:
        return False, "Category name is required"
    
    name = name.strip()
    
    if len(name) < 2:
        return False, "Category name must be at least 2 characters"
    
    if len(name) > 64:
        return False, "Category name cannot exceed 64 characters"
    
    # Check for valid characters
    if not re.match(r'^[\w\s&\-\.]+$', name):
        return False, "Category name can only contain letters, numbers, spaces, and &-."
    
    return True, None


def validate_note(note: str, max_length: int = 255) -> Tuple[bool, Optional[str]]:
    """
    Validate transaction/template note.
    
    Args:
        note: Note text to validate
        max_length: Maximum allowed length
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if note is None:
        return True, None  # Notes are optional
    
    note = note.strip()
    
    if len(note) > max_length:
        return False, f"Note cannot exceed {max_length} characters"
    
    # Check for only printable characters
    if not all(char.isprintable() or char in ['\n', '\t'] for char in note):
        return False, "Note contains invalid characters"
    
    return True, None


def validate_category_type(category_type: str) -> Tuple[bool, Optional[str]]:
    """
    Validate category type.
    
    Args:
        category_type: Type to validate (INCOME or EXPENSE)
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not category_type:
        return True, None  # Will default to EXPENSE
    
    category_type = category_type.upper()
    
    if category_type not in ["INCOME", "EXPENSE"]:
        return False, "Category type must be 'INCOME' or 'EXPENSE'"
    
    return True, None


def validate_budget_limit(limit: any) -> Tuple[bool, Optional[str]]:
    """
    Validate budget limit.
    
    Args:
        limit: Budget limit to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if limit is None:
        return True, None  # Budget limit is optional
    
    try:
        decimal_limit = Decimal(str(limit))
    except (InvalidOperation, ValueError, TypeError):
        return False, "Invalid budget limit format"
    
    if decimal_limit < 0:
        return False, "Budget limit cannot be negative"
    
    if decimal_limit > Decimal('9999999.99'):
        return False, "Budget limit exceeds maximum allowed value"
    
    return True, None


def sanitize_string(text: str, max_length: Optional[int] = None) -> str:
    """
    Sanitize string input by trimming and optionally limiting length.
    
    Args:
        text: Text to sanitize
        max_length: Maximum length to enforce
        
    Returns:
        Sanitized string
    """
    if text is None:
        return ""
    
    text = text.strip()
    
    if max_length and len(text) > max_length:
        text = text[:max_length]
    
    return text


def check_date_range(from_date: str, to_date: str) -> Tuple[bool, Optional[str]]:
    """
    Validate date range.
    
    Args:
        from_date: Start date (YYYY-MM-DD)
        to_date: End date (YYYY-MM-DD)
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not from_date or not to_date:
        return True, None  # Date range is optional
    
    try:
        from_dt = datetime.strptime(from_date, "%Y-%m-%d").date()
        to_dt = datetime.strptime(to_date, "%Y-%m-%d").date()
    except ValueError:
        return False, "Invalid date format. Use YYYY-MM-DD"
    
    if from_dt > to_dt:
        return False, "'from' date cannot be after 'to' date"
    
    # Check if range is too large (optional)
    if (to_dt - from_dt).days > 365:
        return False, "Date range cannot exceed 365 days"
    
    return True, None


# Currency symbol mapping for formatting
CURRENCY_SYMBOLS = {
    'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥',
    'CAD': 'C$', 'AUD': 'A$', 'CHF': 'CHF', 'CNY': '¥',
    'INR': '₹', 'BRL': 'R$', 'MXN': 'Mex$', 'ZAR': 'R',
    'SGD': 'S$', 'HKD': 'HK$', 'NZD': 'NZ$', 'SEK': 'kr',
    'NOK': 'kr', 'DKK': 'kr', 'PLN': 'zł', 'THB': '฿',
    'IDR': 'Rp', 'MYR': 'RM', 'PHP': '₱', 'CZK': 'Kč',
    'ILS': '₪', 'CLP': 'CLP$', 'TRY': '₺', 'AED': 'د.إ',
    'SAR': 'ر.س', 'KRW': '₩'
}


def format_amount(amount: Decimal, currency: str = 'USD') -> str:
    """
    Format amount with currency symbol.
    
    Args:
        amount: Amount to format
        currency: Currency code
        
    Returns:
        Formatted string (e.g., "$1,234.56")
    """
    symbol = CURRENCY_SYMBOLS.get(currency, currency)
    return f"{symbol}{amount:,.2f}"