from django.utils import timezone
from datetime import timedelta, date
from .models import UserStreak, UserStats, Achievement, UserAchievement

def update_user_streak(user, transaction_date=None):
    """
    Update user's streak based on transaction activity
    Should be called whenever a user logs a transaction
    
    Args:
        user: The user object
        transaction_date: The date the transaction was spent (not created).
                         If None, uses today's date.
    """
    streak, created = UserStreak.objects.get_or_create(user=user)
    
    # Use the transaction's spent_at date, not creation date
    # This allows backdated transactions to count for streak
    if transaction_date is None:
        today = timezone.now().date()
    else:
        today = transaction_date
    
    # If first transaction ever
    if not streak.last_activity_date:
        streak.current_streak = 1
        streak.longest_streak = 1
        streak.last_activity_date = today
        streak.total_transactions = 1
        streak.save()
        check_achievements(user)
        return streak
    
    # If already logged today, just increment transaction count
    if streak.last_activity_date == today:
        streak.total_transactions += 1
        streak.save()
        check_achievements(user)
        return streak
    
    # Calculate days since last activity
    yesterday = today - timedelta(days=1)
    
    if streak.last_activity_date == yesterday:
        # Consecutive day - increment streak
        streak.current_streak += 1
        if streak.current_streak > streak.longest_streak:
            streak.longest_streak = streak.current_streak
    elif streak.last_activity_date < yesterday:
        # Streak broken - reset to 1
        streak.current_streak = 1
    
    streak.last_activity_date = today
    streak.total_transactions += 1
    streak.save()
    
    # Check for new achievements
    check_achievements(user)
    
    return streak


def check_achievements(user):
    """
    Check and unlock achievements for user
    Returns list of newly unlocked achievements
    """
    newly_unlocked = []
    
    try:
        streak = UserStreak.objects.get(user=user)
        stats, _ = UserStats.objects.get_or_create(user=user)
    except UserStreak.DoesNotExist:
        return newly_unlocked
    
    # Get all achievements
    all_achievements = Achievement.objects.all()
    
    # Get already unlocked achievement IDs
    unlocked_ids = UserAchievement.objects.filter(user=user).values_list('achievement_id', flat=True)
    
    for achievement in all_achievements:
        # Skip if already unlocked
        if achievement.id in unlocked_ids:
            continue
        
        unlocked = False
        
        # Check streak achievements
        if achievement.achievement_type == 'streak':
            if streak.current_streak >= achievement.requirement_value:
                unlocked = True
        
        # Check transaction count achievements
        elif achievement.achievement_type == 'transaction':
            if streak.total_transactions >= achievement.requirement_value:
                unlocked = True
        
        # Check category achievements
        elif achievement.achievement_type == 'category':
            categories_count = get_user_categories_count(user)
            if categories_count >= achievement.requirement_value:
                unlocked = True
        
        # Check savings achievements - based on your actual model fields
        elif achievement.achievement_type == 'savings':
            monthly_savings = calculate_monthly_savings(user)
            if monthly_savings >= achievement.requirement_value:
                unlocked = True
        
        # Check budget achievements - placeholder
        elif achievement.achievement_type == 'budget':
            weeks_under_budget = calculate_weeks_under_budget(user)
            if weeks_under_budget >= achievement.requirement_value:
                unlocked = True
        
        # Unlock achievement
        if unlocked:
            user_achievement = UserAchievement.objects.create(
                user=user,
                achievement=achievement,
                is_new=True
            )
            
            # Add points to user stats
            stats.total_points += achievement.points
            stats.level = stats.calculate_level()
            stats.save()
            
            newly_unlocked.append(achievement)
    
    return newly_unlocked


def get_user_categories_count(user):
    """Get number of unique categories user has used"""
    from transactions.models import Transaction
    # FIXED: Changed from user=user to owner=user
    return Transaction.objects.filter(owner=user).values('category').distinct().count()


def calculate_monthly_savings(user):
    """
    Calculate user's savings for current month
    Based on your actual Transaction model structure
    """
    from transactions.models import Transaction, Category
    from django.db.models import Sum
    
    today = timezone.now()
    first_day = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Get income categories
    income_categories = Category.objects.filter(owner=user, type=Category.INCOME)
    
    # Get expense categories  
    expense_categories = Category.objects.filter(owner=user, type=Category.EXPENSE)
    
    # FIXED: Using correct field names (owner instead of user, spent_at instead of date)
    income = Transaction.objects.filter(
        owner=user,
        category__in=income_categories,
        spent_at__gte=first_day,
        spent_at__lte=today
    ).aggregate(total=Sum('amount'))['total'] or 0
    
    expenses = Transaction.objects.filter(
        owner=user,
        category__in=expense_categories,
        spent_at__gte=first_day,
        spent_at__lte=today
    ).aggregate(total=Sum('amount'))['total'] or 0
    
    return income - expenses


def calculate_weeks_under_budget(user):
    """
    Calculate consecutive weeks user stayed under budget
    Based on your Category.budget_limit field
    """
    from transactions.models import Transaction, Category
    from django.db.models import Sum
    
    # Get categories with budget limits
    categories_with_budget = Category.objects.filter(
        owner=user, 
        budget_limit__isnull=False,
        type=Category.EXPENSE
    )
    
    if not categories_with_budget.exists():
        return 0
    
    today = timezone.now()
    weeks_under = 0
    
    # Check last 4 weeks
    for week in range(4):
        week_start = today - timedelta(days=today.weekday() + (7 * week))
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        week_end = week_start + timedelta(days=6, hours=23, minutes=59, seconds=59)
        
        all_under_budget = True
        
        for category in categories_with_budget:
            spent = Transaction.objects.filter(
                owner=user,
                category=category,
                spent_at__gte=week_start,
                spent_at__lte=week_end
            ).aggregate(total=Sum('amount'))['total'] or 0
            
            if spent > category.budget_limit:
                all_under_budget = False
                break
        
        if all_under_budget:
            weeks_under += 1
        else:
            break  # Stop counting if a week is over budget
    
    return weeks_under


def get_streak_status(user):
    """Get user's current streak status"""
    try:
        streak = UserStreak.objects.get(user=user)
        today = timezone.now().date()
        
        # Check if streak is still valid
        if streak.last_activity_date:
            days_since_activity = (today - streak.last_activity_date).days
            
            if days_since_activity > 1:
                # Streak is broken but not yet updated
                return {
                    'current_streak': 0,
                    'longest_streak': streak.longest_streak,
                    'status': 'broken',
                    'message': 'Your streak was broken. Start a new one today!'
                }
            elif days_since_activity == 1:
                return {
                    'current_streak': streak.current_streak,
                    'longest_streak': streak.longest_streak,
                    'status': 'at_risk',
                    'message': 'Log a transaction today to continue your streak!'
                }
            else:  # days_since_activity == 0
                return {
                    'current_streak': streak.current_streak,
                    'longest_streak': streak.longest_streak,
                    'status': 'active',
                    'message': f'Great! {streak.current_streak}-day streak active!'
                }
        
        return {
            'current_streak': 0,
            'longest_streak': 0,
            'status': 'new',
            'message': 'Log your first transaction to start a streak!'
        }
    
    except UserStreak.DoesNotExist:
        return {
            'current_streak': 0,
            'longest_streak': 0,
            'status': 'new',
            'message': 'Log your first transaction to start a streak!'
        }