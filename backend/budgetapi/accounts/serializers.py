from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

class RegisterSerializer(serializers.ModelSerializer):
    # incoming fields 
    userName = serializers.CharField(write_only=True)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("userName", "email", "password")

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Email already registered.")
        return value

    def validate_password(self, value):
        # uses Django's password validators if configured
        validate_password(value)
        return value

    def create(self, validated_data):
        username = validated_data.pop("userName")
        email = validated_data.pop("email")
        password = validated_data.pop("password")
        user = User.objects.create_user(username=username, email=email, password=password)
        return user