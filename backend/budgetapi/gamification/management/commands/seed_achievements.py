from django.core.management.base import BaseCommand
from gamification.models import Achievement

class Command(BaseCommand):
    help = 'Seeds the database with initial achievements'

    def handle(self, *args, **kwargs):
        achievements = [
            # Streak Achievements - Realistic progression
            {
                'name': 'First Step',
                'description': 'Log your first transaction',
                'achievement_type': 'transaction',
                'requirement_value': 1,
                'icon': '🎯',
                'points': 10
            },
            {
                'name': '3-Day Streak',
                'description': 'Log transactions for 3 consecutive days',
                'achievement_type': 'streak',
                'requirement_value': 3,
                'icon': '🔥',
                'points': 30
            },
            {
                'name': 'Week Warrior',
                'description': 'Maintain a 7-day logging streak',
                'achievement_type': 'streak',
                'requirement_value': 7,
                'icon': '⚡',
                'points': 70
            },
            {
                'name': '2-Week Champion',
                'description': 'Log transactions for 14 consecutive days',
                'achievement_type': 'streak',
                'requirement_value': 14,
                'icon': '💪',
                'points': 100
            },
            {
                'name': 'Month Master',
                'description': 'Achieve a 30-day logging streak',
                'achievement_type': 'streak',
                'requirement_value': 30,
                'icon': '👑',
                'points': 200
            },
            {
                'name': '100-Day Legend',
                'description': 'Achieve a 100-day logging streak',
                'achievement_type': 'streak',
                'requirement_value': 100,
                'icon': '🏆',
                'points': 500
            },
            
            # Transaction Count Achievements - Realistic progression
            {
                'name': 'Getting Started',
                'description': 'Log 5 transactions',
                'achievement_type': 'transaction',
                'requirement_value': 5,
                'icon': '📝',
                'points': 20
            },
            {
                'name': 'Committed Tracker',
                'description': 'Log 25 transactions',
                'achievement_type': 'transaction',
                'requirement_value': 25,
                'icon': '📊',
                'points': 50
            },
            {
                'name': 'Dedicated Logger',
                'description': 'Log 50 transactions',
                'achievement_type': 'transaction',
                'requirement_value': 50,
                'icon': '📈',
                'points': 100
            },
            {
                'name': 'Transaction Master',
                'description': 'Log 100 transactions',
                'achievement_type': 'transaction',
                'requirement_value': 100,
                'icon': '💎',
                'points': 150
            },
            {
                'name': 'Data Guru',
                'description': 'Log 250 transactions',
                'achievement_type': 'transaction',
                'requirement_value': 250,
                'icon': '🎖️',
                'points': 300
            },
            
            # Category Achievements
            {
                'name': 'Organized Mind',
                'description': 'Use 3 different categories',
                'achievement_type': 'category',
                'requirement_value': 3,
                'icon': '🗂️',
                'points': 25
            },
            {
                'name': 'Category Expert',
                'description': 'Use 7 different categories',
                'achievement_type': 'category',
                'requirement_value': 7,
                'icon': '📚',
                'points': 50
            },
            {
                'name': 'Super Organizer',
                'description': 'Use 12 different categories',
                'achievement_type': 'category',
                'requirement_value': 12,
                'icon': '🎯',
                'points': 100
            },
            
            # Budget Achievements
            {
                'name': 'Budget Conscious',
                'description': 'Stay under budget for 1 week',
                'achievement_type': 'budget',
                'requirement_value': 1,
                'icon': '💰',
                'points': 40
            },
            {
                'name': 'Budget Master',
                'description': 'Stay under budget for 1 month',
                'achievement_type': 'budget',
                'requirement_value': 4,
                'icon': '💸',
                'points': 100
            },
            
            # Savings Achievements
            {
                'name': 'Saver Starter',
                'description': 'Save $100 in a month',
                'achievement_type': 'savings',
                'requirement_value': 100,
                'icon': '🐷',
                'points': 50
            },
            {
                'name': 'Savings Champion',
                'description': 'Save $500 in a month',
                'achievement_type': 'savings',
                'requirement_value': 500,
                'icon': '💵',
                'points': 100
            },
            {
                'name': 'Wealth Builder',
                'description': 'Save $1000 in a month',
                'achievement_type': 'savings',
                'requirement_value': 1000,
                'icon': '🏦',
                'points': 200
            },
        ]

        created_count = 0
        for achievement_data in achievements:
            achievement, created = Achievement.objects.get_or_create(
                name=achievement_data['name'],
                defaults=achievement_data
            )
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'Created achievement: {achievement.name}')
                )

        self.stdout.write(
            self.style.SUCCESS(f'\nSuccessfully created {created_count} achievements!')
        )