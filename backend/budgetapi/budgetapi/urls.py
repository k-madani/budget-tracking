"""
URL configuration for budgetapi project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from accounts.views import register_view, login_view, reset_password_view
from transactions.views import (
    transaction_detail, transactions, transactions_summary,
    categories, category_detail, templates, template_detail, create_from_template)
from gamification.views import (get_gamification_stats, get_all_achievements, 
    mark_achievements_seen, get_new_achievements_count, get_leaderboard)
from budgets.views import (get_forecast_summary, generate_forecast)

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Auth endpoints
    path("api/auth/register", register_view, name="register"),
    path("api/auth/login", login_view, name="login"),
    path("api/auth/reset-password", reset_password_view, name="reset-password"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # Transactions
    path("api/transactions", transactions, name="transactions"),
    path("api/transactions/<uuid:pk>", transaction_detail, name="transaction-detail"),
    path("api/transactions/summary", transactions_summary, name="transactions-summary"),

    # Categories
    path("api/categories", categories, name="categories"),
    path("api/categories/<uuid:pk>", category_detail, name="category-detail"),

    # Achievements
    path('api/stats', get_gamification_stats, name='gamification-stats'),
    path('api/achievements', get_all_achievements, name='all-achievements'),
    path('api/achievements/mark-seen', mark_achievements_seen, name='mark-achievements-seen'),
    path('api/achievements/new-count', get_new_achievements_count, name='new-achievements-count'),
    path('api/leaderboard', get_leaderboard, name='leaderboard'),

    path("api/templates", templates, name="templates"),
    path("api/templates/<uuid:pk>", template_detail, name="template-detail"),
    path("api/templates/<uuid:pk>/use", create_from_template, name="create-from-template"),

    # Forecasts
    path('api/forecasts/summary', get_forecast_summary, name='forecast-summary'),
    path('api/forecasts/generate', generate_forecast, name='generate-forecast')
]
