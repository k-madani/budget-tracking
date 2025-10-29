from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination

from .models import Transaction
from .serializers import TransactionWriteSerializer, TransactionReadSerializer

# internal helper
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

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def transactions(request):
    if request.method == "GET":
        qs = _filter_queryset_for_user(request).order_by("-spent_at", "-created_at")

        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        data = TransactionReadSerializer(page, many=True).data

        return Response({
            "count": paginator.page.paginator.count,
            "results": data
        })

    serializer = TransactionWriteSerializer(data=request.data)
    if serializer.is_valid():
        obj = serializer.save(owner=request.user)
        return Response(TransactionReadSerializer(obj).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def transaction_detail(request, pk):
    tx = get_object_or_404(Transaction, pk=pk, owner=request.user)

    if request.method == "GET":
        return Response(TransactionReadSerializer(tx).data)

    if request.method == "PUT":
        serializer = TransactionWriteSerializer(tx, data=request.data)
        if serializer.is_valid():
            obj = serializer.save()
            return Response(TransactionReadSerializer(obj).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    tx.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
