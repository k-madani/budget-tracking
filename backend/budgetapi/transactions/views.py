from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date, parse_datetime
from django.db.models import Sum
from django.db import DatabaseError, IntegrityError, transaction as db_transaction
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from django.utils import timezone
from datetime import datetime, timedelta
import logging
import uuid as uuid_lib

from .models import Transaction, Category, TransactionTemplate
from .serializers import (
    TransactionWriteSerializer, TransactionReadSerializer,
    CategorySerializer, TransactionTemplateSerializer
)
from .utils import auto_categorize_transaction, get_default_category

logger = logging.getLogger(__name__)


# ---------- Helper Functions ----------
def validate_uuid(uuid_string):
    """Validate UUID format"""
    try:
        uuid_lib.UUID(str(uuid_string))
        return True
    except (ValueError, AttributeError, TypeError):
        return False


def _filter_queryset_for_user(request):
    """
    Filter transactions with date range validation.
    
    Query params:
        - from: YYYY-MM-DD format
        - to: YYYY-MM-DD format
    """
    qs = Transaction.objects.filter(owner=request.user)
    
    date_from = request.query_params.get("from")
    date_to = request.query_params.get("to")
    
    if date_from:
        try:
            d = parse_date(date_from)
            if not d:
                raise ValueError("Invalid date format")
            
            # Validate not too far in the past (optional)
            if d < datetime(2000, 1, 1).date():
                raise ValueError("Date too far in the past")
                
            qs = qs.filter(spent_at__date__gte=d)
        except (ValueError, TypeError) as e:
            logger.warning(f"Invalid 'from' date parameter: {date_from}")
            # Continue without filtering - don't break the request
    
    if date_to:
        try:
            d = parse_date(date_to)
            if not d:
                raise ValueError("Invalid date format")
            
            # Validate not in the future
            if d > timezone.now().date():
                d = timezone.now().date()
                
            qs = qs.filter(spent_at__date__lte=d)
        except (ValueError, TypeError) as e:
            logger.warning(f"Invalid 'to' date parameter: {date_to}")
            # Continue without filtering
    
    # Validate date range
    if date_from and date_to:
        d_from = parse_date(date_from)
        d_to = parse_date(date_to)
        if d_from and d_to and d_from > d_to:
            logger.warning(f"Invalid date range: from={date_from}, to={date_to}")
    
    return qs


# ---------- Transaction Endpoints ----------
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def transactions(request):
    """
    GET: List all transactions with optional date filtering and pagination
    POST: Create a new transaction with auto-categorization
    
    Query params (GET):
        - from: Start date (YYYY-MM-DD)
        - to: End date (YYYY-MM-DD)
        - page: Page number
    
    Returns:
        GET 200: Paginated transaction list
        POST 201: Transaction created
        400: Validation errors
        500: Server error
    """
    try:
        if request.method == "GET":
            try:
                qs = _filter_queryset_for_user(request).order_by("-spent_at", "-created_at")
                
                # Paginate results
                paginator = PageNumberPagination()
                page = paginator.paginate_queryset(qs, request)
                
                if page is not None:
                    data = TransactionReadSerializer(page, many=True).data
                    return Response({
                        "count": paginator.page.paginator.count,
                        "next": paginator.get_next_link(),
                        "previous": paginator.get_previous_link(),
                        "results": data
                    }, status=status.HTTP_200_OK)
                
                # Fallback if pagination fails
                data = TransactionReadSerializer(qs[:100], many=True).data
                return Response({
                    "count": qs.count(),
                    "results": data
                }, status=status.HTTP_200_OK)
                
            except DatabaseError as e:
                logger.error(f"Database error fetching transactions: {str(e)}")
                return Response(
                    {"detail": "Error retrieving transactions"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        # POST - Create transaction
        if not request.data:
            return Response(
                {"detail": "Request body is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate required fields
        required_fields = ["amount", "spent_at"]
        missing_fields = [field for field in required_fields if field not in request.data]
        
        if missing_fields:
            return Response(
                {"detail": f"Missing required fields: {', '.join(missing_fields)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate amount
        try:
            amount = float(request.data.get("amount"))
            if amount <= 0:
                return Response(
                    {"detail": "Amount must be positive"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if amount > 9999999.99:  # Max 10 digits, 2 decimal places
                return Response(
                    {"detail": "Amount exceeds maximum allowed value"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except (ValueError, TypeError):
            return Response(
                {"detail": "Invalid amount format"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate spent_at date
        spent_at_str = request.data.get("spent_at")
        try:
            spent_at = parse_datetime(spent_at_str)
            if not spent_at:
                spent_at = parse_date(spent_at_str)
                if spent_at:
                    spent_at = timezone.make_aware(
                        datetime.combine(spent_at, datetime.min.time())
                    )
            
            if not spent_at:
                return Response(
                    {"detail": "Invalid date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate date is not too far in the future
            if spent_at > timezone.now() + timedelta(days=7):
                return Response(
                    {"detail": "Transaction date cannot be more than 7 days in the future"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate date is not too far in the past
            if spent_at < timezone.make_aware(datetime(2000, 1, 1)):
                return Response(
                    {"detail": "Transaction date is too far in the past"},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        except (ValueError, TypeError) as e:
            return Response(
                {"detail": f"Invalid date format: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Auto-categorization logic
        note = request.data.get("note", "").strip()
        category_id = request.data.get("category")
        
        # Validate category if provided
        if category_id:
            if not validate_uuid(category_id):
                return Response(
                    {"detail": "Invalid category ID format"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                category = Category.objects.get(id=category_id, owner=request.user)
                request.data['category'] = str(category.id)
            except Category.DoesNotExist:
                return Response(
                    {"detail": "Category not found or you don't have permission"},
                    status=status.HTTP_404_NOT_FOUND
                )
            except DatabaseError as e:
                logger.error(f"Database error checking category: {str(e)}")
                return Response(
                    {"detail": "Error validating category"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        # Auto-categorize if no category provided
        if not category_id and note:
            try:
                suggested_category = auto_categorize_transaction(note, request.user)
                if suggested_category:
                    request.data['category'] = str(suggested_category.id)
            except Exception as e:
                logger.warning(f"Auto-categorization failed: {str(e)}")
                # Continue without auto-categorization
        
        # Use default category if still no category
        if not request.data.get('category'):
            try:
                note_lower = note.lower()
                income_keywords = [
                    "salary", "income", "paycheck", "wages", 
                    "freelance", "bonus", "payment received"
                ]
                
                is_income = any(keyword in note_lower for keyword in income_keywords)
                transaction_type = "INCOME" if is_income else "EXPENSE"
                
                default_category = get_default_category(request.user, transaction_type)
                request.data['category'] = str(default_category.id)
            except Exception as e:
                logger.error(f"Error setting default category: {str(e)}")
                return Response(
                    {"detail": "Error processing transaction category"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        # Create transaction using atomic transaction
        try:
            with db_transaction.atomic():
                ser = TransactionWriteSerializer(
                    data=request.data,
                    context={"request": request}
                )
                
                if not ser.is_valid():
                    return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
                
                obj = ser.save(owner=request.user)
                
                # Check for new achievements
                try:
                    from gamification.models import UserAchievement
                    newly_unlocked = UserAchievement.objects.filter(
                        user=request.user,
                        is_new=True
                    ).select_related('achievement')
                    
                    response_data = TransactionReadSerializer(obj).data
                    response_data['newly_unlocked_achievements'] = [{
                        'id': str(ua.achievement.id),
                        'name': ua.achievement.name,
                        'description': ua.achievement.description,
                        'icon': ua.achievement.icon,
                        'points': ua.achievement.points,
                    } for ua in newly_unlocked]
                    
                except Exception as e:
                    logger.warning(f"Error fetching achievements: {str(e)}")
                    response_data = TransactionReadSerializer(obj).data
                    response_data['newly_unlocked_achievements'] = []
                
                return Response(response_data, status=status.HTTP_201_CREATED)
                
        except IntegrityError as e:
            logger.error(f"Database integrity error creating transaction: {str(e)}")
            return Response(
                {"detail": "Transaction could not be created due to data conflict"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        except DatabaseError as e:
            logger.error(f"Database error creating transaction: {str(e)}")
            return Response(
                {"detail": "Database error occurred. Please try again"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    except Exception as e:
        logger.error(f"Unexpected error in transactions endpoint: {str(e)}")
        return Response(
            {"detail": "An unexpected error occurred"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def transaction_detail(request, pk):
    """
    GET: Retrieve a specific transaction
    PUT: Update a transaction
    DELETE: Delete a transaction
    
    Returns:
        GET 200: Transaction details
        PUT 200: Updated transaction
        DELETE 204: No content
        400: Validation errors
        404: Transaction not found
        500: Server error
    """
    try:
        # Validate UUID format
        if not validate_uuid(pk):
            return Response(
                {"detail": "Invalid transaction ID format"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get transaction
        try:
            tx = Transaction.objects.select_related('category', 'owner').get(
                pk=pk,
                owner=request.user
            )
        except Transaction.DoesNotExist:
            return Response(
                {"detail": "Transaction not found or you don't have permission to access it"},
                status=status.HTTP_404_NOT_FOUND
            )
        except DatabaseError as e:
            logger.error(f"Database error fetching transaction {pk}: {str(e)}")
            return Response(
                {"detail": "Error retrieving transaction"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # GET - Return transaction details
        if request.method == "GET":
            try:
                serializer = TransactionReadSerializer(tx)
                return Response(serializer.data, status=status.HTTP_200_OK)
            except Exception as e:
                logger.error(f"Error serializing transaction {pk}: {str(e)}")
                return Response(
                    {"detail": "Error processing transaction data"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        # PUT - Update transaction
        if request.method == "PUT":
            if not request.data:
                return Response(
                    {"detail": "Request body is required"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate amount if provided
            if "amount" in request.data:
                try:
                    amount = float(request.data.get("amount"))
                    if amount <= 0:
                        return Response(
                            {"detail": "Amount must be positive"},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    if amount > 9999999.99:
                        return Response(
                            {"detail": "Amount exceeds maximum allowed value"},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                except (ValueError, TypeError):
                    return Response(
                        {"detail": "Invalid amount format"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Validate spent_at if provided
            if "spent_at" in request.data:
                spent_at_str = request.data.get("spent_at")
                try:
                    spent_at = parse_datetime(spent_at_str)
                    if not spent_at:
                        spent_at = parse_date(spent_at_str)
                        if spent_at:
                            spent_at = timezone.make_aware(
                                datetime.combine(spent_at, datetime.min.time())
                            )
                    
                    if not spent_at:
                        return Response(
                            {"detail": "Invalid date format"},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    
                    if spent_at > timezone.now() + timedelta(days=7):
                        return Response(
                            {"detail": "Transaction date cannot be more than 7 days in the future"},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    
                    if spent_at < timezone.make_aware(datetime(2000, 1, 1)):
                        return Response(
                            {"detail": "Transaction date is too far in the past"},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                except (ValueError, TypeError):
                    return Response(
                        {"detail": "Invalid date format"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Validate category if provided
            if "category" in request.data:
                category_id = request.data.get("category")
                if category_id:
                    if not validate_uuid(category_id):
                        return Response(
                            {"detail": "Invalid category ID format"},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    
                    try:
                        Category.objects.get(id=category_id, owner=request.user)
                    except Category.DoesNotExist:
                        return Response(
                            {"detail": "Category not found or you don't have permission"},
                            status=status.HTTP_404_NOT_FOUND
                        )
            
            # Update transaction
            try:
                with db_transaction.atomic():
                    ser = TransactionWriteSerializer(
                        tx,
                        data=request.data,
                        partial=True,
                        context={"request": request}
                    )
                    
                    if not ser.is_valid():
                        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
                    
                    obj = ser.save()
                    return Response(
                        TransactionReadSerializer(obj).data,
                        status=status.HTTP_200_OK
                    )
                    
            except IntegrityError as e:
                logger.error(f"Database integrity error updating transaction {pk}: {str(e)}")
                return Response(
                    {"detail": "Transaction could not be updated due to data conflict"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            except DatabaseError as e:
                logger.error(f"Database error updating transaction {pk}: {str(e)}")
                return Response(
                    {"detail": "Database error occurred. Please try again"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        # DELETE - Remove transaction
        if request.method == "DELETE":
            try:
                with db_transaction.atomic():
                    tx.delete()
                    logger.info(f"Transaction {pk} deleted by user {request.user.id}")
                    return Response(status=status.HTTP_204_NO_CONTENT)
                    
            except DatabaseError as e:
                logger.error(f"Database error deleting transaction {pk}: {str(e)}")
                return Response(
                    {"detail": "Error deleting transaction. Please try again"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
    
    except Exception as e:
        logger.error(f"Unexpected error in transaction_detail for {pk}: {str(e)}")
        return Response(
            {"detail": "An unexpected error occurred"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def transactions_summary(request):
    """
    Get summary of income, expenses, and balance for filtered date range.
    
    Query params:
        - from: Start date (YYYY-MM-DD)
        - to: End date (YYYY-MM-DD)
    
    Returns:
        200: Summary with income, expense, balance
        500: Server error
    """
    try:
        # Validate query parameters
        date_from = request.query_params.get("from")
        date_to = request.query_params.get("to")
        
        # Validate date formats if provided
        if date_from:
            try:
                d = parse_date(date_from)
                if not d:
                    return Response(
                        {"detail": "Invalid 'from' date format. Use YYYY-MM-DD"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except (ValueError, TypeError):
                return Response(
                    {"detail": "Invalid 'from' date format. Use YYYY-MM-DD"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        if date_to:
            try:
                d = parse_date(date_to)
                if not d:
                    return Response(
                        {"detail": "Invalid 'to' date format. Use YYYY-MM-DD"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except (ValueError, TypeError):
                return Response(
                    {"detail": "Invalid 'to' date format. Use YYYY-MM-DD"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Validate date range
        if date_from and date_to:
            d_from = parse_date(date_from)
            d_to = parse_date(date_to)
            if d_from and d_to and d_from > d_to:
                return Response(
                    {"detail": "'from' date cannot be after 'to' date"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        try:
            # Get filtered queryset
            qs = _filter_queryset_for_user(request)
            
            # Calculate income
            income = qs.filter(category__type=Category.INCOME).aggregate(
                s=Sum("amount")
            )["s"] or 0
            
            # Calculate expenses
            expense = qs.filter(category__type=Category.EXPENSE).aggregate(
                s=Sum("amount")
            )["s"] or 0
            
            # Include uncategorized transactions as expenses
            uncategorized = qs.filter(category__isnull=True).aggregate(
                s=Sum("amount")
            )["s"] or 0
            
            total_expense = float(expense) + float(uncategorized)
            total_income = float(income)
            balance = total_income - total_expense
            
            # Get transaction count for context
            total_transactions = qs.count()
            income_count = qs.filter(category__type=Category.INCOME).count()
            expense_count = qs.filter(category__type=Category.EXPENSE).count()
            uncategorized_count = qs.filter(category__isnull=True).count()
            
            return Response({
                "income": total_income,
                "expense": total_expense,
                "balance": balance,
                "summary": {
                    "total_transactions": total_transactions,
                    "income_transactions": income_count,
                    "expense_transactions": expense_count,
                    "uncategorized_transactions": uncategorized_count
                },
                "date_range": {
                    "from": date_from,
                    "to": date_to
                }
            }, status=status.HTTP_200_OK)
            
        except DatabaseError as e:
            logger.error(f"Database error calculating summary: {str(e)}")
            return Response(
                {"detail": "Error calculating transaction summary"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    except Exception as e:
        logger.error(f"Unexpected error in transactions_summary: {str(e)}")
        return Response(
            {"detail": "An unexpected error occurred"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
# ---------- Category Endpoints ----------
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def categories(request):
    """
    GET: List all categories for the authenticated user
    POST: Create a new category
    
    Returns:
        GET 200: List of categories
        POST 201: Category created
        400: Validation errors
        500: Server error
    """
    try:
        if request.method == "GET":
            try:
                qs = Category.objects.filter(owner=request.user).order_by("name")
                
                # Add query parameter for filtering by type
                category_type = request.query_params.get("type")
                if category_type:
                    category_type = category_type.upper()
                    if category_type not in ["INCOME", "EXPENSE"]:
                        return Response(
                            {"detail": "Invalid category type. Use 'INCOME' or 'EXPENSE'"},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    qs = qs.filter(type=category_type)
                
                serializer = CategorySerializer(qs, many=True)
                return Response({
                    "count": qs.count(),
                    "results": serializer.data
                }, status=status.HTTP_200_OK)
                
            except DatabaseError as e:
                logger.error(f"Database error fetching categories: {str(e)}")
                return Response(
                    {"detail": "Error retrieving categories"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        # POST - Create category
        if not request.data:
            return Response(
                {"detail": "Request body is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate required fields
        if "name" not in request.data:
            return Response(
                {"detail": "Category name is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate name
        name = request.data.get("name", "").strip()
        if not name:
            return Response(
                {"detail": "Category name cannot be empty"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(name) > 64:
            return Response(
                {"detail": "Category name cannot exceed 64 characters"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(name) < 2:
            return Response(
                {"detail": "Category name must be at least 2 characters"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check for duplicate category name (case-insensitive)
        if Category.objects.filter(owner=request.user, name__iexact=name).exists():
            return Response(
                {"detail": "A category with this name already exists"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate type
        category_type = request.data.get("type", "EXPENSE").upper()
        if category_type not in ["INCOME", "EXPENSE"]:
            return Response(
                {"detail": "Category type must be 'INCOME' or 'EXPENSE'"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate budget_limit if provided
        budget_limit = request.data.get("budget_limit")
        if budget_limit is not None:
            try:
                budget_limit = float(budget_limit)
                if budget_limit < 0:
                    return Response(
                        {"detail": "Budget limit cannot be negative"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                if budget_limit > 9999999.99:
                    return Response(
                        {"detail": "Budget limit exceeds maximum allowed value"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except (ValueError, TypeError):
                return Response(
                    {"detail": "Invalid budget limit format"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Check category limit (max 100 categories per user)
        user_categories_count = Category.objects.filter(owner=request.user).count()
        if user_categories_count >= 100:
            return Response(
                {"detail": "You have reached the maximum limit of 100 categories"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            with db_transaction.atomic():
                # Update request data with validated type
                request.data['type'] = category_type
                
                ser = CategorySerializer(data=request.data)
                if not ser.is_valid():
                    return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
                
                category = ser.save(owner=request.user)
                logger.info(f"Category '{name}' created by user {request.user.id}")
                
                return Response(
                    CategorySerializer(category).data,
                    status=status.HTTP_201_CREATED
                )
                
        except IntegrityError as e:
            logger.error(f"Database integrity error creating category: {str(e)}")
            return Response(
                {"detail": "A category with this name already exists"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        except DatabaseError as e:
            logger.error(f"Database error creating category: {str(e)}")
            return Response(
                {"detail": "Database error occurred. Please try again"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    except Exception as e:
        logger.error(f"Unexpected error in categories endpoint: {str(e)}")
        return Response(
            {"detail": "An unexpected error occurred"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def category_detail(request, pk):
    """
    GET: Retrieve a specific category
    PUT: Update a category
    DELETE: Delete a category
    
    Returns:
        GET 200: Category details
        PUT 200: Updated category
        DELETE 204: No content
        400: Validation errors or category in use
        404: Category not found
        500: Server error
    """
    try:
        # Validate UUID format
        if not validate_uuid(pk):
            return Response(
                {"detail": "Invalid category ID format"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get category
        try:
            cat = Category.objects.get(pk=pk, owner=request.user)
        except Category.DoesNotExist:
            return Response(
                {"detail": "Category not found or you don't have permission to access it"},
                status=status.HTTP_404_NOT_FOUND
            )
        except DatabaseError as e:
            logger.error(f"Database error fetching category {pk}: {str(e)}")
            return Response(
                {"detail": "Error retrieving category"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # GET - Return category details
        if request.method == "GET":
            try:
                serializer = CategorySerializer(cat)
                return Response(serializer.data, status=status.HTTP_200_OK)
            except Exception as e:
                logger.error(f"Error serializing category {pk}: {str(e)}")
                return Response(
                    {"detail": "Error processing category data"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        # PUT - Update category
        if request.method == "PUT":
            if not request.data:
                return Response(
                    {"detail": "Request body is required"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate name if provided
            if "name" in request.data:
                name = request.data.get("name", "").strip()
                if not name:
                    return Response(
                        {"detail": "Category name cannot be empty"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                if len(name) > 64:
                    return Response(
                        {"detail": "Category name cannot exceed 64 characters"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                if len(name) < 2:
                    return Response(
                        {"detail": "Category name must be at least 2 characters"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Check for duplicate (excluding current category)
                if Category.objects.filter(
                    owner=request.user,
                    name__iexact=name
                ).exclude(pk=pk).exists():
                    return Response(
                        {"detail": "A category with this name already exists"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Validate type if provided
            if "type" in request.data:
                category_type = request.data.get("type", "").upper()
                if category_type not in ["INCOME", "EXPENSE"]:
                    return Response(
                        {"detail": "Category type must be 'INCOME' or 'EXPENSE'"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                request.data['type'] = category_type
            
            # Validate budget_limit if provided
            if "budget_limit" in request.data:
                budget_limit = request.data.get("budget_limit")
                if budget_limit is not None:
                    try:
                        budget_limit = float(budget_limit)
                        if budget_limit < 0:
                            return Response(
                                {"detail": "Budget limit cannot be negative"},
                                status=status.HTTP_400_BAD_REQUEST
                            )
                        if budget_limit > 9999999.99:
                            return Response(
                                {"detail": "Budget limit exceeds maximum allowed value"},
                                status=status.HTTP_400_BAD_REQUEST
                            )
                    except (ValueError, TypeError):
                        return Response(
                            {"detail": "Invalid budget limit format"},
                            status=status.HTTP_400_BAD_REQUEST
                        )
            
            try:
                with db_transaction.atomic():
                    ser = CategorySerializer(cat, data=request.data, partial=True)
                    if not ser.is_valid():
                        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
                    
                    updated_cat = ser.save()
                    logger.info(f"Category {pk} updated by user {request.user.id}")
                    
                    return Response(
                        CategorySerializer(updated_cat).data,
                        status=status.HTTP_200_OK
                    )
                    
            except IntegrityError as e:
                logger.error(f"Database integrity error updating category {pk}: {str(e)}")
                return Response(
                    {"detail": "A category with this name already exists"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            except DatabaseError as e:
                logger.error(f"Database error updating category {pk}: {str(e)}")
                return Response(
                    {"detail": "Database error occurred. Please try again"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        # DELETE - Remove category
        if request.method == "DELETE":
            # Check if category is in use
            try:
                transactions_count = Transaction.objects.filter(category=cat).count()
                templates_count = TransactionTemplate.objects.filter(category=cat).count()
                
                if transactions_count > 0 or templates_count > 0:
                    return Response({
                        "detail": "Cannot delete category that is in use by transactions or templates",
                        "transactions_count": transactions_count,
                        "templates_count": templates_count
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                with db_transaction.atomic():
                    cat.delete()
                    logger.info(f"Category {pk} deleted by user {request.user.id}")
                    return Response(status=status.HTTP_204_NO_CONTENT)
                    
            except DatabaseError as e:
                logger.error(f"Database error deleting category {pk}: {str(e)}")
                return Response(
                    {"detail": "Error deleting category. Please try again"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
    
    except Exception as e:
        logger.error(f"Unexpected error in category_detail for {pk}: {str(e)}")
        return Response(
            {"detail": "An unexpected error occurred"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# ---------- Transaction Template Endpoints ----------
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def templates(request):
    """
    GET: List all transaction templates for the authenticated user
    POST: Create a new transaction template
    
    Returns:
        GET 200: List of templates
        POST 201: Template created
        400: Validation errors
        500: Server error
    """
    try:
        if request.method == "GET":
            try:
                qs = TransactionTemplate.objects.filter(
                    owner=request.user
                ).select_related('category').order_by("-is_favorite", "name")
                
                # Filter by favorite status if requested
                is_favorite = request.query_params.get("favorite")
                if is_favorite is not None:
                    if is_favorite.lower() in ["true", "1"]:
                        qs = qs.filter(is_favorite=True)
                    elif is_favorite.lower() in ["false", "0"]:
                        qs = qs.filter(is_favorite=False)
                
                serializer = TransactionTemplateSerializer(qs, many=True)
                return Response({
                    "count": qs.count(),
                    "results": serializer.data
                }, status=status.HTTP_200_OK)
                
            except DatabaseError as e:
                logger.error(f"Database error fetching templates: {str(e)}")
                return Response(
                    {"detail": "Error retrieving templates"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        # POST - Create template
        if not request.data:
            return Response(
                {"detail": "Request body is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate required fields
        required_fields = ["name", "amount", "category"]
        missing_fields = [field for field in required_fields if field not in request.data]
        
        if missing_fields:
            return Response(
                {"detail": f"Missing required fields: {', '.join(missing_fields)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate name
        name = request.data.get("name", "").strip()
        if not name:
            return Response(
                {"detail": "Template name cannot be empty"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(name) > 100:
            return Response(
                {"detail": "Template name cannot exceed 100 characters"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(name) < 2:
            return Response(
                {"detail": "Template name must be at least 2 characters"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check for duplicate template name
        if TransactionTemplate.objects.filter(
            owner=request.user,
            name__iexact=name
        ).exists():
            return Response(
                {"detail": "A template with this name already exists"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate amount
        try:
            amount = float(request.data.get("amount"))
            if amount <= 0:
                return Response(
                    {"detail": "Amount must be positive"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if amount > 9999999.99:
                return Response(
                    {"detail": "Amount exceeds maximum allowed value"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except (ValueError, TypeError):
            return Response(
                {"detail": "Invalid amount format"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate category
        category_id = request.data.get("category")
        if not validate_uuid(category_id):
            return Response(
                {"detail": "Invalid category ID format"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            Category.objects.get(id=category_id, owner=request.user)
        except Category.DoesNotExist:
            return Response(
                {"detail": "Category not found or you don't have permission"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Validate note length if provided
        note = request.data.get("note", "")
        if len(note) > 255:
            return Response(
                {"detail": "Note cannot exceed 255 characters"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check template limit (max 50 templates per user)
        user_templates_count = TransactionTemplate.objects.filter(owner=request.user).count()
        if user_templates_count >= 50:
            return Response(
                {"detail": "You have reached the maximum limit of 50 templates"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            with db_transaction.atomic():
                ser = TransactionTemplateSerializer(
                    data=request.data,
                    context={"request": request}
                )
                
                if not ser.is_valid():
                    return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
                
                template = ser.save(owner=request.user)
                logger.info(f"Template '{name}' created by user {request.user.id}")
                
                return Response(
                    TransactionTemplateSerializer(template).data,
                    status=status.HTTP_201_CREATED
                )
                
        except IntegrityError as e:
            logger.error(f"Database integrity error creating template: {str(e)}")
            return Response(
                {"detail": "A template with this name already exists"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        except DatabaseError as e:
            logger.error(f"Database error creating template: {str(e)}")
            return Response(
                {"detail": "Database error occurred. Please try again"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    except Exception as e:
        logger.error(f"Unexpected error in templates endpoint: {str(e)}")
        return Response(
            {"detail": "An unexpected error occurred"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def template_detail(request, pk):
    """
    GET: Retrieve a specific template
    PUT: Update a template
    DELETE: Delete a template
    
    Returns:
        GET 200: Template details
        PUT 200: Updated template
        DELETE 204: No content
        400: Validation errors
        404: Template not found
        500: Server error
    """
    try:
        # Validate UUID format
        if not validate_uuid(pk):
            return Response(
                {"detail": "Invalid template ID format"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get template
        try:
            template = TransactionTemplate.objects.select_related('category').get(
                pk=pk,
                owner=request.user
            )
        except TransactionTemplate.DoesNotExist:
            return Response(
                {"detail": "Template not found or you don't have permission to access it"},
                status=status.HTTP_404_NOT_FOUND
            )
        except DatabaseError as e:
            logger.error(f"Database error fetching template {pk}: {str(e)}")
            return Response(
                {"detail": "Error retrieving template"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # GET - Return template details
        if request.method == "GET":
            try:
                serializer = TransactionTemplateSerializer(template)
                return Response(serializer.data, status=status.HTTP_200_OK)
            except Exception as e:
                logger.error(f"Error serializing template {pk}: {str(e)}")
                return Response(
                    {"detail": "Error processing template data"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        # PUT - Update template
        if request.method == "PUT":
            if not request.data:
                return Response(
                    {"detail": "Request body is required"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate name if provided
            if "name" in request.data:
                name = request.data.get("name", "").strip()
                if not name:
                    return Response(
                        {"detail": "Template name cannot be empty"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                if len(name) > 100:
                    return Response(
                        {"detail": "Template name cannot exceed 100 characters"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                if len(name) < 2:
                    return Response(
                        {"detail": "Template name must be at least 2 characters"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Check for duplicate (excluding current template)
                if TransactionTemplate.objects.filter(
                    owner=request.user,
                    name__iexact=name
                ).exclude(pk=pk).exists():
                    return Response(
                        {"detail": "A template with this name already exists"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Validate amount if provided
            if "amount" in request.data:
                try:
                    amount = float(request.data.get("amount"))
                    if amount <= 0:
                        return Response(
                            {"detail": "Amount must be positive"},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    if amount > 9999999.99:
                        return Response(
                            {"detail": "Amount exceeds maximum allowed value"},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                except (ValueError, TypeError):
                    return Response(
                        {"detail": "Invalid amount format"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Validate category if provided
            if "category" in request.data:
                category_id = request.data.get("category")
                if not validate_uuid(category_id):
                    return Response(
                        {"detail": "Invalid category ID format"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                try:
                    Category.objects.get(id=category_id, owner=request.user)
                except Category.DoesNotExist:
                    return Response(
                        {"detail": "Category not found or you don't have permission"},
                        status=status.HTTP_404_NOT_FOUND
                    )
            
            # Validate note if provided
            if "note" in request.data:
                note = request.data.get("note", "")
                if len(note) > 255:
                    return Response(
                        {"detail": "Note cannot exceed 255 characters"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            try:
                with db_transaction.atomic():
                    ser = TransactionTemplateSerializer(
                        template,
                        data=request.data,
                        partial=True,
                        context={"request": request}
                    )
                    
                    if not ser.is_valid():
                        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
                    
                    updated_template = ser.save()
                    logger.info(f"Template {pk} updated by user {request.user.id}")
                    
                    return Response(
                        TransactionTemplateSerializer(updated_template).data,
                        status=status.HTTP_200_OK
                    )
                    
            except IntegrityError as e:
                logger.error(f"Database integrity error updating template {pk}: {str(e)}")
                return Response(
                    {"detail": "A template with this name already exists"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            except DatabaseError as e:
                logger.error(f"Database error updating template {pk}: {str(e)}")
                return Response(
                    {"detail": "Database error occurred. Please try again"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        # DELETE - Remove template
        if request.method == "DELETE":
            try:
                with db_transaction.atomic():
                    template.delete()
                    logger.info(f"Template {pk} deleted by user {request.user.id}")
                    return Response(status=status.HTTP_204_NO_CONTENT)
                    
            except DatabaseError as e:
                logger.error(f"Database error deleting template {pk}: {str(e)}")
                return Response(
                    {"detail": "Error deleting template. Please try again"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
    
    except Exception as e:
        logger.error(f"Unexpected error in template_detail for {pk}: {str(e)}")
        return Response(
            {"detail": "An unexpected error occurred"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_from_template(request, pk):
    """
    Create a transaction from a template.
    
    Optional payload:
    {
        "spent_at": "2024-01-15T10:30:00Z"  # Optional, defaults to now
    }
    
    Returns:
        201: Transaction created
        400: Validation errors
        404: Template not found
        500: Server error
    """
    try:
        # Validate UUID format
        if not validate_uuid(pk):
            return Response(
                {"detail": "Invalid template ID format"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get template
        try:
            template = TransactionTemplate.objects.select_related('category').get(
                pk=pk,
                owner=request.user
            )
        except TransactionTemplate.DoesNotExist:
            return Response(
                {"detail": "Template not found or you don't have permission to access it"},
                status=status.HTTP_404_NOT_FOUND
            )
        except DatabaseError as e:
            logger.error(f"Database error fetching template {pk}: {str(e)}")
            return Response(
                {"detail": "Error retrieving template"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Validate category still exists
        try:
            category = Category.objects.get(id=template.category.id, owner=request.user)
        except Category.DoesNotExist:
            return Response(
                {"detail": "Template category no longer exists"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get or set spent_at datetime
        spent_at = request.data.get("spent_at") if request.data else None
        
        if spent_at:
            try:
                spent_at_dt = parse_datetime(spent_at)
                if not spent_at_dt:
                    spent_at_dt = parse_date(spent_at)
                    if spent_at_dt:
                        spent_at_dt = timezone.make_aware(
                            datetime.combine(spent_at_dt, datetime.min.time())
                        )
                
                if not spent_at_dt:
                    return Response(
                        {"detail": "Invalid date format"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                if spent_at_dt > timezone.now() + timedelta(days=7):
                    return Response(
                        {"detail": "Transaction date cannot be more than 7 days in the future"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                spent_at = spent_at_dt.isoformat()
            except (ValueError, TypeError):
                return Response(
                    {"detail": "Invalid date format"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            spent_at = timezone.now().isoformat()
        
        # Prepare transaction data from template
        transaction_data = {
            "amount": str(template.amount),
            "currency": template.currency,
            "note": template.note or "",
            "spent_at": spent_at,
            "category": str(template.category.id)
        }
        
        try:
            with db_transaction.atomic():
                ser = TransactionWriteSerializer(
                    data=transaction_data,
                    context={"request": request}
                )
                
                if not ser.is_valid():
                    return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
                
                obj = ser.save(owner=request.user)
                logger.info(f"Transaction created from template {pk} by user {request.user.id}")
                
                return Response(
                    TransactionReadSerializer(obj).data,
                    status=status.HTTP_201_CREATED
                )
                
        except IntegrityError as e:
            logger.error(f"Database integrity error creating transaction from template: {str(e)}")
            return Response(
                {"detail": "Transaction could not be created due to data conflict"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        except DatabaseError as e:
            logger.error(f"Database error creating transaction from template: {str(e)}")
            return Response(
                {"detail": "Database error occurred. Please try again"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    except Exception as e:
        logger.error(f"Unexpected error in create_from_template for {pk}: {str(e)}")
        return Response(
            {"detail": "An unexpected error occurred"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )