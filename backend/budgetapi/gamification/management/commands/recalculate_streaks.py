"""
Save this as: backend/gamification/management/commands/recalculate_streaks.py
Run with: python manage.py recalculate_streaks <username>

This will rebuild the streak from scratch based on transaction history
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from gamification.models import UserStreak
from transactions.models import Transaction
from datetime import timedelta

User = get_user_model()

class Command(BaseCommand):
    help = 'Recalculate user streaks from transaction history'

    def add_arguments(self, parser):
        parser.add_argument('username', type=str, nargs='?', help='Username to recalculate (or all if not provided)')
        parser.add_argument('--all', action='store_true', help='Recalculate for all users')

    def handle(self, *args, **kwargs):
        username = kwargs.get('username')
        all_users = kwargs.get('all')
        
        if all_users or not username:
            users = User.objects.all()
            self.stdout.write(self.style.WARNING(f'Recalculating streaks for {users.count()} users...\n'))
        else:
            try:
                users = [User.objects.get(username=username)]
            except User.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'User "{username}" not found'))
                return
        
        for user in users:
            self.recalculate_user_streak(user)
    
    def recalculate_user_streak(self, user):
        """Recalculate streak for a single user based on transaction history"""
        self.stdout.write(f'\n=== {user.username} ===')
        
        # Get all transactions ordered by spent_at date
        transactions = Transaction.objects.filter(owner=user).order_by('spent_at')
        
        if not transactions.exists():
            self.stdout.write(self.style.WARNING('No transactions found'))
            return
        
        # Get or create streak object
        streak, created = UserStreak.objects.get_or_create(user=user)
        
        # Reset streak data
        streak.total_transactions = transactions.count()
        
        # Get unique dates (one entry per day)
        transaction_dates = set(txn.spent_at.date() for txn in transactions)
        sorted_dates = sorted(transaction_dates)
        
        self.stdout.write(f'Total transactions: {len(transactions)}')
        self.stdout.write(f'Unique transaction dates: {len(sorted_dates)}')
        self.stdout.write(f'Date range: {sorted_dates[0]} to {sorted_dates[-1]}')
        
        # Calculate longest streak
        longest_streak = 1
        current_streak = 1
        
        for i in range(1, len(sorted_dates)):
            prev_date = sorted_dates[i - 1]
            curr_date = sorted_dates[i]
            
            # Check if consecutive
            if curr_date == prev_date + timedelta(days=1):
                current_streak += 1
                if current_streak > longest_streak:
                    longest_streak = current_streak
            else:
                current_streak = 1
        
        # Calculate current streak (from most recent date)
        from django.utils import timezone
        today = timezone.now().date()
        most_recent = sorted_dates[-1]
        
        days_since = (today - most_recent).days
        
        if days_since == 0:
            # Active today - count backwards
            active_streak = 1
            for i in range(len(sorted_dates) - 2, -1, -1):
                if sorted_dates[i] == sorted_dates[i + 1] - timedelta(days=1):
                    active_streak += 1
                else:
                    break
            current_active_streak = active_streak
        elif days_since == 1:
            # Last transaction was yesterday - count backwards including today
            active_streak = 1
            for i in range(len(sorted_dates) - 2, -1, -1):
                if sorted_dates[i] == sorted_dates[i + 1] - timedelta(days=1):
                    active_streak += 1
                else:
                    break
            current_active_streak = active_streak
        else:
            # Streak is broken
            current_active_streak = 0
        
        # Update streak record
        streak.current_streak = current_active_streak
        streak.longest_streak = longest_streak
        streak.last_activity_date = most_recent
        streak.save()
        
        self.stdout.write(self.style.SUCCESS(f'✓ Updated:'))
        self.stdout.write(f'  Current Streak: {streak.current_streak} days')
        self.stdout.write(f'  Longest Streak: {streak.longest_streak} days')
        self.stdout.write(f'  Last Activity: {streak.last_activity_date}')
        self.stdout.write(f'  Days Since Activity: {days_since}')