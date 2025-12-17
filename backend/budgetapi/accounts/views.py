from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import RegisterSerializer
from transactions.models import Category

@api_view(["POST"])
@permission_classes([AllowAny])
def register_view(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
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
        
        for cat_data in starter_categories:
            Category.objects.create(owner=user, **cat_data)
        
        return Response({
            "message": "User registered successfully",
            "categories_created": len(starter_categories)
        }, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    email = request.data.get("email")
    password = request.data.get("password")

    if not email:
        return Response({"detail": "email is required"}, status=status.HTTP_400_BAD_REQUEST)
    elif not password:
        return Response({"detail": "password is required"}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user_obj = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        return Response({"detail": "Invalid credentials"}, status=status.HTTP_400_BAD_REQUEST)

    user = authenticate(username=user_obj.username, password=password)
    if not user:
        return Response({"detail": "Invalid credentials"}, status=status.HTTP_400_BAD_REQUEST)

    # Create JWT tokens
    refresh = RefreshToken.for_user(user)
    return Response(
        {"refresh": str(refresh), "access": str(refresh.access_token)},
        status=status.HTTP_200_OK
    )