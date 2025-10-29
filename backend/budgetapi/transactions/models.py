import uuid
from django.conf import settings
from django.db import models

class Transaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="transactions")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="USD")
    note = models.CharField(max_length=255, blank=True, null=True)
    spent_at = models.DateTimeField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-spent_at", "-created_at")

    def __str__(self):
        return f"{self.owner.username} {self.amount} {self.currency} on {self.spent_at:%Y-%m-%d}"
