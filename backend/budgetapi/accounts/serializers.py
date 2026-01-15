from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
import re


class RegisterSerializer(serializers.ModelSerializer):
    """
    Serializer for user registration with comprehensive validation.
    """
    userName = serializers.CharField(
        write_only=True,
        min_length=3,
        max_length=150,
        error_messages={
            'min_length': 'Username must be at least 3 characters long',
            'max_length': 'Username cannot exceed 150 characters',
            'required': 'Username is required',
            'blank': 'Username cannot be blank'
        }
    )
    email = serializers.EmailField(
        error_messages={
            'required': 'Email is required',
            'invalid': 'Enter a valid email address',
            'blank': 'Email cannot be blank'
        }
    )
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        max_length=128,
        error_messages={
            'min_length': 'Password must be at least 8 characters long',
            'max_length': 'Password cannot exceed 128 characters',
            'required': 'Password is required',
            'blank': 'Password cannot be blank'
        }
    )

    class Meta:
        model = User
        fields = ("userName", "email", "password")

    def validate_userName(self, value):
        """
        Validate username for:
        - Uniqueness (case-insensitive)
        - No leading/trailing whitespace
        - Allowed characters only
        """
        # Strip whitespace
        value = value.strip()
        
        if not value:
            raise serializers.ValidationError("Username cannot be empty or whitespace only")
        
        # Check for valid characters (alphanumeric, underscore, hyphen, period)
        if not re.match(r'^[\w.-]+$', value):
            raise serializers.ValidationError(
                "Username can only contain letters, numbers, underscores, hyphens, and periods"
            )
        
        # Check if starts with valid character
        if not value[0].isalnum():
            raise serializers.ValidationError("Username must start with a letter or number")
        
        # Check uniqueness (case-insensitive)
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is already taken")
        
        return value

    def validate_email(self, value):
        """
        Validate email for:
        - Format
        - Uniqueness (case-insensitive)
        - No leading/trailing whitespace
        - Basic domain validation
        """
        # Strip whitespace and convert to lowercase
        value = value.strip().lower()
        
        if not value:
            raise serializers.ValidationError("Email cannot be empty or whitespace only")
        
        # Additional email validation
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_regex, value):
            raise serializers.ValidationError("Enter a valid email address")
        
        # Check for common temporary email domains (optional - add your blocklist)
        blocked_domains = ['tempmail.com', '10minutemail.com', 'guerrillamail.com']
        domain = value.split('@')[1]
        if domain in blocked_domains:
            raise serializers.ValidationError("Temporary email addresses are not allowed")
        
        # Check uniqueness (case-insensitive)
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email is already registered")
        
        return value

    def validate_password(self, value):
        """
        Validate password using Django's password validators.
        """
        if not value:
            raise serializers.ValidationError("Password cannot be empty")
        
        # Check for whitespace
        if value != value.strip():
            raise serializers.ValidationError("Password cannot start or end with whitespace")
        
        try:
            # Use Django's built-in password validators
            validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        
        return value

    def validate(self, attrs):
        """
        Object-level validation for cross-field checks.
        """
        username = attrs.get('userName', '').strip()
        email = attrs.get('email', '').strip().lower()
        password = attrs.get('password')
        
        # Ensure password doesn't contain username or email
        if username and password:
            if username.lower() in password.lower():
                raise serializers.ValidationError({
                    "password": "Password cannot contain your username"
                })
        
        if email and password:
            email_local = email.split('@')[0]
            if email_local.lower() in password.lower():
                raise serializers.ValidationError({
                    "password": "Password cannot contain parts of your email"
                })
        
        return attrs

    def create(self, validated_data):
        """
        Create user with validated data.
        """
        username = validated_data.pop("userName").strip()
        email = validated_data.pop("email").strip().lower()
        password = validated_data.pop("password")
        
        try:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password
            )
            return user
        except Exception as e:
            raise serializers.ValidationError(
                f"Error creating user: {str(e)}"
            )