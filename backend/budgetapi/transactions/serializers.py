from rest_framework import serializers
from .models import Transaction

class TransactionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ("amount", "currency", "note", "spent_at")

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        return value

    def validate_currency(self, value):
        v = (value or "").upper()
        if len(v) != 3:
            raise serializers.ValidationError("Currency must be a 3-letter code, e.g., USD.")
        return v

class TransactionReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ("id", "amount", "currency", "note", "spent_at", "created_at", "updated_at")
        read_only_fields = fields
