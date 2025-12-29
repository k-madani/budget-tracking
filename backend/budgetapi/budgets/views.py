from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .services.forecast_service import SpendingForecastService
from .models import SpendingForecast
from datetime import datetime
from dateutil.relativedelta import relativedelta

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_forecast_summary(request):
    """Get comprehensive forecast summary"""
    service = SpendingForecastService(request.user)
    
    # Generate forecasts
    forecasts = service.generate_forecasts(months_ahead=1)
    
    # Get warnings
    warnings = service.get_budget_warnings()
    
    # Calculate totals
    total_predicted = sum(float(f.predicted_amount) for f in forecasts)
    total_historical = sum(float(f.historical_average) for f in forecasts)
    
    # Get forecast next month date
    next_month = (datetime.now() + relativedelta(months=1)).strftime('%B %Y')
    
    return Response({
        'summary': {
            'forecast_month': next_month,
            'total_predicted_spending': round(total_predicted, 2),
            'total_historical_average': round(total_historical, 2),
            'change_percentage': round(((total_predicted - total_historical) / total_historical * 100) if total_historical else 0, 1),
            'warning_count': len(warnings)
        },
        'forecasts': [{
            'category': f.category,
            'predicted_amount': float(f.predicted_amount),
            'confidence_score': float(f.confidence_score),
            'trend': f.trend,
            'historical_average': float(f.historical_average)
        } for f in forecasts],
        'warnings': warnings
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def generate_forecast(request):
    """Generate fresh forecasts"""
    months_ahead = int(request.query_params.get('months', 1))
    
    service = SpendingForecastService(request.user)
    forecasts = service.generate_forecasts(months_ahead)
    
    forecast_data = [{
        'category': f.category,
        'forecast_month': f.forecast_month,
        'predicted_amount': float(f.predicted_amount),
        'confidence_score': float(f.confidence_score),
        'historical_average': float(f.historical_average),
        'trend': f.trend
    } for f in forecasts]
    
    return Response({
        'forecasts': forecast_data,
        'generated_at': datetime.now().isoformat()
    })