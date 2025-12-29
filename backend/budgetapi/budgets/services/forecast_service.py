from decimal import Decimal
from datetime import datetime
from dateutil.relativedelta import relativedelta
from django.db.models import Sum
from django.db.models.functions import TruncMonth
from transactions.models import Transaction, TransactionTemplate  # Import from transactions app
from budgets.models import SpendingForecast, Budget
import numpy as np

class SpendingForecastService:
    def __init__(self, user):
        self.user = user
        
    def generate_forecasts(self, months_ahead=1):
        """Generate spending forecasts for the next N months"""
        forecasts = []
        
        # Get all categories user has spent on
        categories = Transaction.objects.filter(
            user=self.user,
            type='expense'
        ).values_list('category', flat=True).distinct()
        
        for category in categories:
            forecast = self._forecast_category(category, months_ahead)
            if forecast:
                forecasts.append(forecast)
                
        return forecasts
    
    def _forecast_category(self, category, months_ahead=1):
        """Generate forecast for a specific category"""
        # Get historical data (last 6 months)
        six_months_ago = datetime.now() - relativedelta(months=6)
        
        transactions = Transaction.objects.filter(
            user=self.user,
            category=category,
            type='expense',
            date__gte=six_months_ago
        )
        
        if transactions.count() < 3:  # Need at least 3 transactions
            return None
            
        # Calculate monthly spending
        monthly_spending = transactions.annotate(
            month=TruncMonth('date')
        ).values('month').annotate(
            total=Sum('amount')
        ).order_by('month')
        
        amounts = [float(item['total']) for item in monthly_spending]
        
        if not amounts:
            return None
            
        # Calculate statistics
        avg_spending = np.mean(amounts)
        std_dev = np.std(amounts) if len(amounts) > 1 else 0
        
        # Detect trend
        trend = self._detect_trend(amounts)
        
        # Predict next month
        predicted_amount = self._predict_amount(amounts, trend)
        
        # Calculate confidence score
        confidence = self._calculate_confidence(amounts, std_dev, avg_spending)
        
        # Factor in recurring transactions
        recurring_adjustment = self._get_recurring_adjustment(category)
        predicted_amount += recurring_adjustment
        
        # Create or update forecast
        forecast_month = (datetime.now() + relativedelta(months=months_ahead)).replace(day=1).date()
        
        forecast, created = SpendingForecast.objects.update_or_create(
            user=self.user,
            category=category,
            forecast_month=forecast_month,
            defaults={
                'predicted_amount': Decimal(str(round(predicted_amount, 2))),
                'confidence_score': Decimal(str(round(confidence, 2))),
                'historical_average': Decimal(str(round(avg_spending, 2))),
                'trend': trend
            }
        )
        
        return forecast
    
    def _detect_trend(self, amounts):
        """Detect if spending is increasing, decreasing, or stable"""
        if len(amounts) < 2:
            return 'stable'
            
        # Simple linear regression slope
        x = np.arange(len(amounts))
        slope = np.polyfit(x, amounts, 1)[0]
        
        # Threshold: 5% change relative to mean
        threshold = np.mean(amounts) * 0.05
        
        if slope > threshold:
            return 'increasing'
        elif slope < -threshold:
            return 'decreasing'
        else:
            return 'stable'
    
    def _predict_amount(self, amounts, trend):
        """Predict next month's amount"""
        if len(amounts) == 0:
            return 0
            
        # Weight recent months more heavily
        weights = np.exp(np.linspace(-1, 0, len(amounts)))
        weights = weights / weights.sum()
        
        weighted_avg = np.average(amounts, weights=weights)
        
        # Adjust based on trend
        if trend == 'increasing':
            return weighted_avg * 1.10
        elif trend == 'decreasing':
            return weighted_avg * 0.90
        else:
            return weighted_avg
    
    def _calculate_confidence(self, amounts, std_dev, mean):
        """Calculate confidence score (0-1)"""
        if mean == 0:
            return 0.5
            
        # Coefficient of variation
        cv = std_dev / mean if mean != 0 else 1
        
        # More data points = higher confidence
        data_points_factor = min(len(amounts) / 6, 1.0)
        
        # Lower variation = higher confidence
        consistency_factor = max(0, 1 - cv)
        
        return (consistency_factor * 0.7 + data_points_factor * 0.3)
    
    def _get_recurring_adjustment(self, category):
        """Add expected recurring transactions"""
        templates = TransactionTemplate.objects.filter(
            user=self.user,
            category=category,
            is_favorite=True
        )
        
        total_recurring = sum(float(t.amount) for t in templates)
        return total_recurring
    
    def get_budget_warnings(self):
        """Check forecasts against budgets"""
        warnings = []
        forecasts = SpendingForecast.objects.filter(user=self.user)
        
        for forecast in forecasts:
            try:
                budget = Budget.objects.get(
                    user=self.user,
                    category=forecast.category
                )
                
                if forecast.predicted_amount > budget.limit:
                    overage_pct = ((forecast.predicted_amount - budget.limit) / budget.limit) * 100
                    
                    warnings.append({
                        'category': forecast.category,
                        'budget_limit': float(budget.limit),
                        'predicted_amount': float(forecast.predicted_amount),
                        'overage_percentage': round(overage_pct, 1),
                        'trend': forecast.trend,
                        'confidence': float(forecast.confidence_score)
                    })
            except Budget.DoesNotExist:
                continue
                
        return warnings