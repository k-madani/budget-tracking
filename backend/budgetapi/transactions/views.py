from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from django.db.models import Sum
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination

from .models import Transaction, Category, TransactionTemplate
from .serializers import (
    TransactionWriteSerializer, TransactionReadSerializer,
    CategorySerializer, TransactionTemplateSerializer
)
from .utils import auto_categorize_transaction, get_default_category

# ---------- helpers ----------
def _filter_queryset_for_user(request):
    qs = Transaction.objects.filter(owner=request.user)
    date_from = request.query_params.get("from")
    date_to = request.query_params.get("to")
    if date_from:
        d = parse_date(date_from)
        if d:
            qs = qs.filter(spent_at__date__gte=d)
    if date_to:
        d = parse_date(date_to)
        if d:
            qs = qs.filter(spent_at__date__lte=d)
    return qs

# ---------- transactions ----------
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def transactions(request):
    if request.method == "GET":
        qs = _filter_queryset_for_user(request).order_by("-spent_at", "-created_at")
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        data = TransactionReadSerializer(page, many=True).data
        return Response({"count": paginator.page.paginator.count, "results": data})

    # POST - Create transaction with auto-categorization
    note = request.data.get("note", "")
    category_id = request.data.get("category")
    
    # Auto-categorization logic (existing code)
    if not category_id and note:
        suggested_category = auto_categorize_transaction(note, request.user)
        if suggested_category:
            request.data['category'] = str(suggested_category.id)
    
    if not request.data.get('category'):
        note_lower = note.lower()
        income_keywords = ["salary", "income", "paycheck", "wages", "freelance", "bonus", "payment received"]
        
        is_income = any(keyword in note_lower for keyword in income_keywords)
        transaction_type = "INCOME" if is_income else "EXPENSE"
        
        default_category = get_default_category(request.user, transaction_type)
        request.data['category'] = str(default_category.id)
    
    ser = TransactionWriteSerializer(data=request.data, context={"request": request})
    if ser.is_valid():
        obj = ser.save(owner=request.user)
        
        # ✅ CHECK FOR NEW ACHIEVEMENTS
        from gamification.models import UserAchievement
        newly_unlocked = UserAchievement.objects.filter(
            user=request.user, 
            is_new=True
        ).select_related('achievement')
        
        response_data = TransactionReadSerializer(obj).data
        response_data['newly_unlocked_achievements'] = [{
            'id': ua.achievement.id,
            'name': ua.achievement.name,
            'description': ua.achievement.description,
            'icon': ua.achievement.icon,
            'points': ua.achievement.points,
        } for ua in newly_unlocked]
        
        return Response(response_data, status=status.HTTP_201_CREATED)

@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def transaction_detail(request, pk):
    tx = get_object_or_404(Transaction, pk=pk, owner=request.user)

    if request.method == "GET":
        return Response(TransactionReadSerializer(tx).data)

    if request.method == "PUT":
        ser = TransactionWriteSerializer(tx, data=request.data, context={"request": request})
        if ser.is_valid():
            obj = ser.save()
            return Response(TransactionReadSerializer(obj).data)
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    tx.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

# ---------- summary ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def transactions_summary(request):
    qs = _filter_queryset_for_user(request)

    income = qs.filter(category__type=Category.INCOME).aggregate(s=Sum("amount"))["s"] or 0
    expense = qs.filter(category__type=Category.EXPENSE).aggregate(s=Sum("amount"))["s"] or 0

    # Include uncategorized as expense
    uncategorized = qs.filter(category__isnull=True).aggregate(s=Sum("amount"))["s"] or 0
    expense = (expense or 0) + (uncategorized or 0)

    balance = (income or 0) - (expense or 0)

    return Response({
        "income": float(income),
        "expense": float(expense),
        "balance": float(balance)
    })

# ---------- categories ----------
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def categories(request):
    if request.method == "GET":
        qs = Category.objects.filter(owner=request.user).order_by("name")
        return Response(CategorySerializer(qs, many=True).data)

    # POST
    ser = CategorySerializer(data=request.data)
    if ser.is_valid():
        ser.save(owner=request.user)
        return Response(ser.data, status=status.HTTP_200_OK)
    return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["PUT", "DELETE", "GET"])
@permission_classes([IsAuthenticated])
def category_detail(request, pk):
    cat = get_object_or_404(Category, pk=pk, owner=request.user)
    if request.method == "GET":
        return Response(CategorySerializer(cat).data)
    if request.method == "PUT":
        ser = CategorySerializer(cat, data=request.data, partial=True)
        if ser.is_valid():
            ser.save()
            return Response(ser.data)
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
    # DELETE
    cat.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

# Add these imports at the top
from .models import Transaction, Category, TransactionTemplate
from .serializers import (
    TransactionWriteSerializer, TransactionReadSerializer,
    CategorySerializer, TransactionTemplateSerializer
)

# Add these views at the end

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def templates(request):
    if request.method == "GET":
        qs = TransactionTemplate.objects.filter(owner=request.user).order_by("-is_favorite", "name")
        return Response(TransactionTemplateSerializer(qs, many=True).data)

    # POST - Create template
    ser = TransactionTemplateSerializer(data=request.data, context={"request": request})
    if ser.is_valid():
        ser.save(owner=request.user)
        return Response(ser.data, status=status.HTTP_201_CREATED)
    return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def template_detail(request, pk):
    template = get_object_or_404(TransactionTemplate, pk=pk, owner=request.user)

    if request.method == "GET":
        return Response(TransactionTemplateSerializer(template).data)

    if request.method == "PUT":
        ser = TransactionTemplateSerializer(template, data=request.data, partial=True, context={"request": request})
        if ser.is_valid():
            ser.save()
            return Response(ser.data)
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    # DELETE
    template.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_from_template(request, pk):
    """Create a transaction from a template"""
    template = get_object_or_404(TransactionTemplate, pk=pk, owner=request.user)
    
    # Use current datetime or provided spent_at
    spent_at = request.data.get("spent_at")
    if not spent_at:
        from django.utils import timezone
        spent_at = timezone.now().isoformat()
    
    transaction_data = {
        "amount": str(template.amount),
        "currency": template.currency,
        "note": template.note or "",
        "spent_at": spent_at,
        "category": str(template.category.id)
    }
    
    ser = TransactionWriteSerializer(data=transaction_data, context={"request": request})
    if ser.is_valid():
        obj = ser.save(owner=request.user)
        return Response(TransactionReadSerializer(obj).data, status=status.HTTP_201_CREATED)
    
    return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)