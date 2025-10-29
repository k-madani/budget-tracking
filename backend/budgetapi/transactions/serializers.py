from rest_framework import serializers
from .models import Transaction, Category

class TransactionWriteSerializer(serializers.ModelSerializer):
    # accepts category UUID; optional for now
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), required=False, allow_null=True
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
        # ensure category belongs to the requester
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
    class Meta:
        model = Category
        fields = ("id", "name", "type")
