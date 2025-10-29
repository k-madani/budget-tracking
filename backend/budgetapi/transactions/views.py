from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from django.db.models import Sum
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination

from .models import Transaction, Category
from .serializers import (
    TransactionWriteSerializer, TransactionReadSerializer,
    CategorySerializer
)

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
        # your simplified response (no next/previous)
        return Response({"count": paginator.page.paginator.count, "results": data})

    # POST
    ser = TransactionWriteSerializer(data=request.data, context={"request": request})
    if ser.is_valid():
        obj = ser.save(owner=request.user)
        return Response(TransactionReadSerializer(obj).data, status=status.HTTP_201_CREATED)
    return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

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

    # sum amounts by category type; uncategorized are treated as EXPENSE by default (you can change)
    income = qs.filter(category__type=Category.INCOME).aggregate(s=Sum("amount"))["s"] or 0
    expense = qs.filter(category__type=Category.EXPENSE).aggregate(s=Sum("amount"))["s"] or 0

    # (optional) include uncategorized as expense:
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
        return Response(ser.data, status=status.HTTP_201_CREATED)
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
