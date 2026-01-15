from rest_framework import serializers
from django.db import models as django_models
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from .models import Transaction, Category, TransactionTemplate
import re


class TransactionWriteSerializer(serializers.ModelSerializer):
    """
    Serializer for creating and updating transactions with comprehensive validation.
    """
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        required=False,
        allow_null=True,
        error_messages={
            'required': 'Category is required',
            'does_not_exist': 'Invalid category ID',
            'incorrect_type': 'Category ID must be a valid UUID'
        }
    )

    class Meta:
        model = Transaction
        fields = ("amount", "currency", "note", "spent_at", "category")

    def validate_amount(self, value):
        """
        Validate transaction amount.
        """
        if value is None:
            raise serializers.ValidationError("Amount is required")
        
        try:
            amount = Decimal(str(value))
        except (InvalidOperation, ValueError, TypeError):
            raise serializers.ValidationError("Invalid amount format")
        
        if amount <= 0:
            raise serializers.ValidationError("Amount must be positive")
        
        if amount > Decimal('9999999.99'):
            raise serializers.ValidationError("Amount exceeds maximum allowed value (9,999,999.99)")
        
        # Check decimal places
        if amount.as_tuple().exponent < -2:
            raise serializers.ValidationError("Amount cannot have more than 2 decimal places")
        
        return value

    def validate_currency(self, value):
        """
        Validate currency code.
        """
        if not value:
            return "USD"  # Default currency
        
        v = value.upper().strip()
        
        if len(v) != 3:
            raise serializers.ValidationError("Currency must be a 3-letter code (e.g., USD, EUR)")
        
        if not v.isalpha():
            raise serializers.ValidationError("Currency code must contain only letters")
        
        # Optional: Validate against a list of supported currencies
        supported_currencies = [
            'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'BRL',
            'MXN', 'ZAR', 'SGD', 'HKD', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'THB',
            'IDR', 'MYR', 'PHP', 'CZK', 'ILS', 'CLP', 'TRY', 'AED', 'SAR', 'KRW'
        ]
        
        if v not in supported_currencies:
            raise serializers.ValidationError(
                f"Unsupported currency code. Supported currencies: {', '.join(supported_currencies[:10])}..."
            )
        
        return v

    def validate_note(self, value):
        """
        Validate transaction note.
        """
        if value is None:
            return ""
        
        value = value.strip()
        
        if len(value) > 255:
            raise serializers.ValidationError("Note cannot exceed 255 characters")
        
        # Optional: Sanitize input (remove potentially harmful characters)
        # Keep only printable ASCII and common unicode characters
        if not all(char.isprintable() or char in ['\n', '\t'] for char in value):
            raise serializers.ValidationError("Note contains invalid characters")
        
        return value

    def validate_spent_at(self, value):
        """
        Validate transaction datetime.
        """
        if value is None:
            raise serializers.ValidationError("Transaction date is required")
        
        # Ensure timezone awareness
        if timezone.is_naive(value):
            value = timezone.make_aware(value)
        
        # Validate not too far in the future
        max_future = timezone.now() + timedelta(days=7)
        if value > max_future:
            raise serializers.ValidationError(
                "Transaction date cannot be more than 7 days in the future"
            )
        
        # Validate not too far in the past
        min_past = timezone.make_aware(datetime(2000, 1, 1))
        if value < min_past:
            raise serializers.ValidationError("Transaction date is too far in the past")
        
        return value

    def validate_category(self, value):
        """
        Validate category belongs to the requester.
        """
        request = self.context.get("request")
        
        if value is not None:
            if not hasattr(value, 'owner_id'):
                raise serializers.ValidationError("Invalid category")
            
            if value.owner_id != request.user.id:
                raise serializers.ValidationError(
                    "You don't have permission to use this category"
                )
        
        return value

    def validate(self, attrs):
        """
        Object-level validation.
        """
        # If updating, ensure we don't change critical fields inappropriately
        if self.instance:
            # Log the update for audit purposes
            pass
        
        return attrs


class TransactionReadSerializer(serializers.ModelSerializer):
    """
    Serializer for reading transaction data with related fields.
    """
    category_name = serializers.CharField(source="category.name", read_only=True, allow_null=True)
    category_type = serializers.CharField(source="category.type", read_only=True, allow_null=True)
    
    # Add formatted amounts for frontend convenience
    formatted_amount = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = (
            "id", "amount", "formatted_amount", "currency", "note", 
            "spent_at", "created_at", "updated_at",
            "category", "category_name", "category_type"
        )
        read_only_fields = (
            "id", "created_at", "updated_at", "category_name", 
            "category_type", "formatted_amount"
        )
    
    def get_formatted_amount(self, obj):
        """Return formatted amount with currency symbol"""
        currency_symbols = {
            'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥',
            'CAD': 'C$', 'AUD': 'A$', 'CHF': 'CHF', 'CNY': '¥',
            'INR': '₹', 'BRL': 'R$'
        }
        symbol = currency_symbols.get(obj.currency, obj.currency)
        return f"{symbol}{obj.amount:,.2f}"


class CategorySerializer(serializers.ModelSerializer):
    """
    Serializer for category with current spending calculation.
    """
    current_spending = serializers.SerializerMethodField()
    transaction_count = serializers.SerializerMethodField()
    budget_status = serializers.SerializerMethodField()
    
    class Meta:
        model = Category
        fields = (
            "id", "name", "type", "budget_limit", 
            "current_spending", "transaction_count", "budget_status"
        )
        read_only_fields = ("id", "current_spending", "transaction_count", "budget_status")
    
    def validate_name(self, value):
        """
        Validate category name.
        """
        if not value:
            raise serializers.ValidationError("Category name is required")
        
        value = value.strip()
        
        if len(value) < 2:
            raise serializers.ValidationError("Category name must be at least 2 characters")
        
        if len(value) > 64:
            raise serializers.ValidationError("Category name cannot exceed 64 characters")
        
        # Check for valid characters
        if not re.match(r'^[\w\s&\-\.]+$', value):
            raise serializers.ValidationError(
                "Category name can only contain letters, numbers, spaces, and &-."
            )
        
        return value
    
    def validate_type(self, value):
        """
        Validate category type.
        """
        if not value:
            return "EXPENSE"  # Default type
        
        value = value.upper()
        
        if value not in ["INCOME", "EXPENSE"]:
            raise serializers.ValidationError("Category type must be 'INCOME' or 'EXPENSE'")
        
        return value
    
    def validate_budget_limit(self, value):
        """
        Validate budget limit.
        """
        if value is None:
            return None
        
        try:
            limit = Decimal(str(value))
        except (InvalidOperation, ValueError, TypeError):
            raise serializers.ValidationError("Invalid budget limit format")
        
        if limit < 0:
            raise serializers.ValidationError("Budget limit cannot be negative")
        
        if limit > Decimal('9999999.99'):
            raise serializers.ValidationError("Budget limit exceeds maximum allowed value")
        
        return value
    
    def get_current_spending(self, obj):
        """Calculate current month spending for this category"""
        from django.utils import timezone
        from datetime import datetime
        
        now = timezone.now()
        month_start = datetime(now.year, now.month, 1)
        month_start = timezone.make_aware(month_start)
        
        spending = obj.transactions.filter(
            spent_at__gte=month_start,
            spent_at__lte=now
        ).aggregate(total=django_models.Sum('amount'))['total'] or 0
        
        return float(spending)
    
    def get_transaction_count(self, obj):
        """Get total transaction count for this category"""
        return obj.transactions.count()
    
    def get_budget_status(self, obj):
        """Calculate budget status"""
        if not obj.budget_limit:
            return None
        
        current_spending = self.get_current_spending(obj)
        budget_limit = float(obj.budget_limit)
        
        percentage_used = (current_spending / budget_limit * 100) if budget_limit > 0 else 0
        
        return {
            "limit": budget_limit,
            "spent": current_spending,
            "remaining": max(0, budget_limit - current_spending),
            "percentage_used": round(percentage_used, 2),
            "is_over_budget": current_spending > budget_limit
        }


class TransactionTemplateSerializer(serializers.ModelSerializer):
    """
    Serializer for transaction templates.
    """
    category_name = serializers.CharField(source="category.name", read_only=True)
    category_type = serializers.CharField(source="category.type", read_only=True)
    
    class Meta:
        model = TransactionTemplate
        fields = (
            "id", "name", "amount", "currency", "note", "category",
            "category_name", "category_type", "is_favorite", "created_at", "updated_at"
        )
        read_only_fields = ("id", "created_at", "updated_at", "category_name", "category_type")
    
    def validate_name(self, value):
        """
        Validate template name.
        """
        if not value:
            raise serializers.ValidationError("Template name is required")
        
        value = value.strip()
        
        if len(value) < 2:
            raise serializers.ValidationError("Template name must be at least 2 characters")
        
        if len(value) > 100:
            raise serializers.ValidationError("Template name cannot exceed 100 characters")
        
        return value
    
    def validate_amount(self, value):
        """
        Validate template amount.
        """
        if value is None:
            raise serializers.ValidationError("Amount is required")
        
        try:
            amount = Decimal(str(value))
        except (InvalidOperation, ValueError, TypeError):
            raise serializers.ValidationError("Invalid amount format")
        
        if amount <= 0:
            raise serializers.ValidationError("Amount must be positive")
        
        if amount > Decimal('9999999.99'):
            raise serializers.ValidationError("Amount exceeds maximum allowed value")
        
        return value
    
    def validate_currency(self, value):
        """
        Validate currency code.
        """
        if not value:
            return "USD"
        
        v = value.upper().strip()
        
        if len(v) != 3:
            raise serializers.ValidationError("Currency must be a 3-letter code")
        
        if not v.isalpha():
            raise serializers.ValidationError("Currency code must contain only letters")
        
        return v
    
    def validate_note(self, value):
        """
        Validate template note.
        """
        if value is None:
            return ""
        
        value = value.strip()
        
        if len(value) > 255:
            raise serializers.ValidationError("Note cannot exceed 255 characters")
        
        return value
    
    def validate_category(self, value):
        """
        Validate category belongs to requester.
        """
        request = self.context.get("request")
        
        if not value:
            raise serializers.ValidationError("Category is required")
        
        if value.owner_id != request.user.id:
            raise serializers.ValidationError(
                "You don't have permission to use this category"
            )
        
        return value