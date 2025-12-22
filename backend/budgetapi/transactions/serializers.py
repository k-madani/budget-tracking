from rest_framework import serializers
from django.db import models as django_models
from .models import Transaction, Category

class TransactionWriteSerializer(serializers.ModelSerializer):
    # Make category optional
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), 
        required=False,
        allow_null=True
    )

    class Meta:
        model = Transaction
        fields = ("amount", "currency", "note", "spent_at", "category")

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        return value

    def validate_currency(self, value):
        v = (value or "").upper()
        if len(v) != 3:
            raise serializers.ValidationError("Currency must be a 3-letter code, e.g., USD.")
        return v

    def validate_category(self, value):
        # ensure category belongs to the requester (if provided)
        request = self.context.get("request")
        if value is not None and value.owner_id != request.user.id:
            raise serializers.ValidationError("Invalid category.")
        return value

class TransactionReadSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    category_type = serializers.CharField(source="category.type", read_only=True)

    class Meta:
        model = Transaction
        fields = ("id", "amount", "currency", "note", "spent_at", "created_at", "updated_at",
                  "category", "category_name", "category_type")
        read_only_fields = ("id", "created_at", "updated_at", "category_name", "category_type")

class CategorySerializer(serializers.ModelSerializer):
    current_spending = serializers.SerializerMethodField()
    
    class Meta:
        model = Category
        fields = ("id", "name", "type", "budget_limit", "current_spending")
    
    def get_current_spending(self, obj):
        """Calculate current month spending for this category"""
        from django.utils import timezone
        from datetime import datetime
        
        # Get current month's start and end
        now = timezone.now()
        month_start = datetime(now.year, now.month, 1)
        
        # Calculate spending for this category in current month
        spending = obj.transactions.filter(
            spent_at__gte=month_start,
            spent_at__lte=now
        ).aggregate(total=django_models.Sum('amount'))['total'] or 0
        
        return float(spending)