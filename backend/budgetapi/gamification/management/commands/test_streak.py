"""
Save this as: backend/gamification/management/commands/test_streak.py
Run with: python manage.py test_streak <username>
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from gamification.models import UserStreak
from gamification.utils import update_user_streak, get_streak_status
from transactions.models import Transaction

User = get_user_model()

class Command(BaseCommand):
    help = 'Test and debug streak system for a user'

    def add_arguments(self, parser):
        parser.add_argument('username', type=str, help='Username to test')

    def handle(self, *args, **kwargs):
        username = kwargs['username']
        
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'User "{username}" not found'))
            return
        
        self.stdout.write(self.style.SUCCESS(f'\n=== Testing Streak for {username} ===\n'))
        
        # Get current streak data
        try:
            streak = UserStreak.objects.get(user=user)
            self.stdout.write(f'Current Streak: {streak.current_streak} days')
            self.stdout.write(f'Longest Streak: {streak.longest_streak} days')
            self.stdout.write(f'Last Activity: {streak.last_activity_date}')
            self.stdout.write(f'Total Transactions: {streak.total_transactions}')
        except UserStreak.DoesNotExist:
            self.stdout.write(self.style.WARNING('No streak record found'))
        
        # Get streak status
        status = get_streak_status(user)
        self.stdout.write(f'\nStatus: {status["status"]}')
        self.stdout.write(f'Message: {status["message"]}\n')
        
        # Get recent transactions
        recent_txns = Transaction.objects.filter(owner=user).order_by('-spent_at')[:10]
        self.stdout.write(f'Recent Transactions ({recent_txns.count()}):')
        for txn in recent_txns:
            self.stdout.write(f'  - {txn.spent_at.date()}: {txn.amount} {txn.currency}')
        
        # Test manual update
        self.stdout.write(self.style.WARNING('\n--- Testing Manual Streak Update ---'))
        try:
            # Use the most recent transaction's date
            latest_txn = Transaction.objects.filter(owner=user).order_by('-spent_at').first()
            if latest_txn:
                result = update_user_streak(user, latest_txn.spent_at.date())
                self.stdout.write(self.style.SUCCESS(f'✓ Streak update successful (using date: {latest_txn.spent_at.date()})'))
            else:
                result = update_user_streak(user)
                self.stdout.write(self.style.SUCCESS('✓ Streak update successful'))
            self.stdout.write(f'New Current Streak: {result.current_streak}')
            self.stdout.write(f'New Longest Streak: {result.longest_streak}')
            self.stdout.write(f'Total Transactions: {result.total_transactions}')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'✗ Error updating streak: {str(e)}'))
            import traceback
            self.stdout.write(traceback.format_exc())