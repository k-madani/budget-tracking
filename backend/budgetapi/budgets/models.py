from django.db import models
from django.contrib.auth.models import User
from decimal import Decimal

class Budget(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='budgets')
    category = models.CharField(max_length=100)
    limit = models.DecimalField(max_digits=10, decimal_places=2)
    period = models.CharField(max_length=20, choices=[
        ('monthly', 'Monthly'),
        ('weekly', 'Weekly'),
        ('yearly', 'Yearly')
    ], default='monthly')
    start_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['user', 'category', 'period']
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.category}: ${self.limit}"

class SpendingForecast(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='forecasts')
    category = models.CharField(max_length=100)
    forecast_month = models.DateField()  # First day of forecasted month
    predicted_amount = models.DecimalField(max_digits=10, decimal_places=2)
    confidence_score = models.DecimalField(max_digits=3, decimal_places=2)  # 0-1
    historical_average = models.DecimalField(max_digits=10, decimal_places=2)
    trend = models.CharField(max_length=20, choices=[
        ('increasing', 'Increasing'),
        ('decreasing', 'Decreasing'),
        ('stable', 'Stable')
    ])
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['user', 'category', 'forecast_month']
        ordering = ['-forecast_month']
    
    def __str__(self):
        return f"{self.user.username} - {self.category} forecast for {self.forecast_month}"