from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, DatabaseError, transaction as db_transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import RegisterSerializer
from transactions.models import Category
import logging

logger = logging.getLogger(__name__)


@api_view(["POST"])
@permission_classes([AllowAny])
def register_view(request):
    """
    Register a new user and create starter categories.
    
    Expected payload:
    {
        "userName": "string",
        "email": "valid@email.com",
        "password": "string (min 8 chars)"
    }
    
    Returns:
        201: User created successfully
        400: Validation errors
        500: Server error
    """
    try:
        # Validate request body exists
        if not request.data:
            return Response(
                {"detail": "Request body is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate required fields
        required_fields = ["userName", "email", "password"]
        missing_fields = [field for field in required_fields if not request.data.get(field)]
        
        if missing_fields:
            return Response(
                {"detail": f"Missing required fields: {', '.join(missing_fields)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate email format
        email = request.data.get("email", "").strip()
        if not email or "@" not in email:
            return Response(
                {"detail": "Invalid email format"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate username
        username = request.data.get("userName", "").strip()
        if not username or len(username) < 3:
            return Response(
                {"detail": "Username must be at least 3 characters long"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(username) > 150:
            return Response(
                {"detail": "Username cannot exceed 150 characters"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if username already exists
        if User.objects.filter(username__iexact=username).exists():
            return Response(
                {"detail": "Username already taken"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate password strength
        password = request.data.get("password")
        try:
            validate_password(password)
        except DjangoValidationError as e:
            return Response(
                {"detail": list(e.messages)},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Use database transaction for atomicity
        try:
            with db_transaction.atomic():
                serializer = RegisterSerializer(data=request.data)
                
                if not serializer.is_valid():
                    return Response(
                        serializer.errors,
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                user = serializer.save()
                
                # Create starter categories
                starter_categories = [
                    # Expense categories
                    {"name": "Food & Dining", "type": "EXPENSE"},
                    {"name": "Groceries", "type": "EXPENSE"},
                    {"name": "Transportation", "type": "EXPENSE"},
                    {"name": "Shopping", "type": "EXPENSE"},
                    {"name": "Entertainment", "type": "EXPENSE"},
                    {"name": "Bills & Utilities", "type": "EXPENSE"},
                    {"name": "Healthcare", "type": "EXPENSE"},
                    {"name": "Other Expenses", "type": "EXPENSE"},
                    
                    # Income categories
                    {"name": "Salary", "type": "INCOME"},
                    {"name": "Freelance", "type": "INCOME"},
                    {"name": "Other Income", "type": "INCOME"},
                ]
                
                categories_created = []
                for cat_data in starter_categories:
                    try:
                        cat = Category.objects.create(owner=user, **cat_data)
                        categories_created.append(cat)
                    except IntegrityError:
                        # Skip if category already exists (shouldn't happen, but safe)
                        logger.warning(f"Category {cat_data['name']} already exists for user {user.id}")
                        continue
                
                return Response({
                    "message": "User registered successfully",
                    "user_id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "categories_created": len(categories_created)
                }, status=status.HTTP_201_CREATED)
                
        except IntegrityError as e:
            logger.error(f"Database integrity error during registration: {str(e)}")
            return Response(
                {"detail": "A user with this email or username already exists"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        except DatabaseError as e:
            logger.error(f"Database error during registration: {str(e)}")
            return Response(
                {"detail": "Database error occurred. Please try again later"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    except Exception as e:
        logger.error(f"Unexpected error during registration: {str(e)}")
        return Response(
            {"detail": "An unexpected error occurred. Please try again later"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    """
    Authenticate user and return JWT tokens.
    
    Expected payload:
    {
        "email": "valid@email.com",
        "password": "string"
    }
    
    Returns:
        200: Login successful with tokens
        400: Missing required fields
        401: Invalid credentials
        500: Server error
    """
    try:
        # Validate request body exists
        if not request.data:
            return Response(
                {"detail": "Request body is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        email = request.data.get("email", "").strip()
        password = request.data.get("password")
        
        # Validate required fields
        if not email:
            return Response(
                {"detail": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not password:
            return Response(
                {"detail": "Password is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate email format
        if "@" not in email:
            return Response(
                {"detail": "Invalid email format"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Find user by email
            user_obj = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            # Don't reveal whether user exists
            return Response(
                {"detail": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        except DatabaseError as e:
            logger.error(f"Database error during login user lookup: {str(e)}")
            return Response(
                {"detail": "Service temporarily unavailable"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Authenticate user
        user = authenticate(username=user_obj.username, password=password)
        
        if not user:
            return Response(
                {"detail": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Check if user is active
        if not user.is_active:
            return Response(
                {"detail": "Account is disabled"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            # Create JWT tokens
            refresh = RefreshToken.for_user(user)
            
            return Response({
                "refresh": str(refresh),
                "access": str(refresh.access_token),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email
                }
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error generating JWT tokens: {str(e)}")
            return Response(
                {"detail": "Error generating authentication tokens"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    except Exception as e:
        logger.error(f"Unexpected error during login: {str(e)}")
        return Response(
            {"detail": "An unexpected error occurred. Please try again later"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
@permission_classes([AllowAny])
def reset_password_view(request):
    """
    Reset user password (WARNING: This should be secured with email verification in production).
    
    Expected payload:
    {
        "email": "valid@email.com",
        "new_password": "string (min 8 chars)"
    }
    
    Returns:
        200: Password reset successful
        400: Validation errors
        404: User not found
        500: Server error
    """
    try:
        # Validate request body exists
        if not request.data:
            return Response(
                {"detail": "Request body is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        email = request.data.get("email", "").strip()
        new_password = request.data.get("new_password")
        
        # Validate required fields
        if not email:
            return Response(
                {"detail": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not new_password:
            return Response(
                {"detail": "New password is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate email format
        if "@" not in email:
            return Response(
                {"detail": "Invalid email format"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate password strength
        try:
            validate_password(new_password)
        except DjangoValidationError as e:
            return Response(
                {"detail": list(e.messages)},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Find user by email
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response(
                {"detail": "User with this email does not exist"},
                status=status.HTTP_404_NOT_FOUND
            )
        except DatabaseError as e:
            logger.error(f"Database error during password reset lookup: {str(e)}")
            return Response(
                {"detail": "Service temporarily unavailable"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        try:
            # Update password using atomic transaction
            with db_transaction.atomic():
                user.set_password(new_password)
                user.save()
            
            logger.info(f"Password reset successful for user: {user.id}")
            
            return Response(
                {"message": "Password reset successfully"},
                status=status.HTTP_200_OK
            )
            
        except DatabaseError as e:
            logger.error(f"Database error during password update: {str(e)}")
            return Response(
                {"detail": "Failed to update password. Please try again later"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    except Exception as e:
        logger.error(f"Unexpected error during password reset: {str(e)}")
        return Response(
            {"detail": "An unexpected error occurred. Please try again later"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def user_profile(request):
    """
    GET: Retrieve current user profile
    PATCH: Update user profile (email, first_name, last_name)
    
    Returns:
        GET 200: User profile data
        PATCH 200: Updated profile
        400: Validation errors
        500: Server error
    """
    try:
        user = request.user
        
        if request.method == "GET":
            return Response({
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name or "",
                "last_name": user.last_name or "",
                "date_joined": user.date_joined.isoformat(),
            }, status=status.HTTP_200_OK)
        
        # PATCH - Update profile
        if request.method == "PATCH":
            if not request.data:
                return Response(
                    {"detail": "Request body is required"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate and update email if provided
            if "email" in request.data:
                email = request.data.get("email", "").strip().lower()
                
                if not email:
                    return Response(
                        {"detail": "Email cannot be empty"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                if "@" not in email:
                    return Response(
                        {"detail": "Invalid email format"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Check if email is already taken by another user
                if User.objects.filter(email__iexact=email).exclude(id=user.id).exists():
                    return Response(
                        {"detail": "This email is already in use"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                user.email = email
            
            # Update optional fields
            if "first_name" in request.data:
                first_name = request.data.get("first_name", "").strip()
                if len(first_name) > 150:
                    return Response(
                        {"detail": "First name cannot exceed 150 characters"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                user.first_name = first_name
            
            if "last_name" in request.data:
                last_name = request.data.get("last_name", "").strip()
                if len(last_name) > 150:
                    return Response(
                        {"detail": "Last name cannot exceed 150 characters"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                user.last_name = last_name
            
            try:
                with db_transaction.atomic():
                    user.save()
                
                logger.info(f"Profile updated for user: {user.id}")
                
                return Response({
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "first_name": user.first_name or "",
                    "last_name": user.last_name or "",
                    "date_joined": user.date_joined.isoformat(),
                    "message": "Profile updated successfully"
                }, status=status.HTTP_200_OK)
                
            except DatabaseError as e:
                logger.error(f"Database error updating profile: {str(e)}")
                return Response(
                    {"detail": "Failed to update profile. Please try again later"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
    
    except Exception as e:
        logger.error(f"Unexpected error in user_profile: {str(e)}")
        return Response(
            {"detail": "An unexpected error occurred"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    """
    Change user password with validation.
    
    Expected payload:
    {
        "old_password": "string",
        "new_password": "string (min 8 chars)"
    }
    
    Returns:
        200: Password changed successfully
        400: Validation errors
        401: Incorrect current password
        500: Server error
    """
    try:
        user = request.user
        
        if not request.data:
            return Response(
                {"detail": "Request body is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        old_password = request.data.get("old_password")
        new_password = request.data.get("new_password")
        
        # Validate required fields
        if not old_password:
            return Response(
                {"detail": "Current password is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not new_password:
            return Response(
                {"detail": "New password is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify current password
        if not user.check_password(old_password):
            return Response(
                {"detail": "Current password is incorrect"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Check if new password is same as old
        if old_password == new_password:
            return Response(
                {"detail": "New password must be different from current password"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate new password strength
        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as e:
            return Response(
                {"detail": list(e.messages)},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Update password using atomic transaction
            with db_transaction.atomic():
                user.set_password(new_password)
                user.save()
            
            logger.info(f"Password changed successfully for user: {user.id}")
            
            return Response(
                {"message": "Password changed successfully"},
                status=status.HTTP_200_OK
            )
            
        except DatabaseError as e:
            logger.error(f"Database error during password change: {str(e)}")
            return Response(
                {"detail": "Failed to change password. Please try again later"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    except Exception as e:
        logger.error(f"Unexpected error during password change: {str(e)}")
        return Response(
            {"detail": "An unexpected error occurred"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )