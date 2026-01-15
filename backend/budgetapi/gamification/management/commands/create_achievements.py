from django.core.management.base import BaseCommand
from gamification.models import Achievement

class Command(BaseCommand):
    help = 'Create default achievements'

    def handle(self, *args, **kwargs):
        achievements = [
            # Transaction achievements
            {'name': 'First Step', 'description': 'Add your first transaction', 'type': 'transaction', 'requirement': 1, 'icon': '🎯', 'points': 10},
            {'name': 'Getting Started', 'description': 'Add 5 transactions', 'type': 'transaction', 'requirement': 5, 'icon': '⭐', 'points': 25},
            {'name': 'Tracking Pro', 'description': 'Add 20 transactions', 'type': 'transaction', 'requirement': 20, 'icon': '🏆', 'points': 50},
            {'name': 'Budget Master', 'description': 'Add 50 transactions', 'type': 'transaction', 'requirement': 50, 'icon': '👑', 'points': 100},
            
            # Category achievements
            {'name': 'Organized', 'description': 'Use 3 different categories', 'type': 'category', 'requirement': 3, 'icon': '📁', 'points': 15},
            {'name': 'Categorizer', 'description': 'Use 5 different categories', 'type': 'category', 'requirement': 5, 'icon': '🗂️', 'points': 30},
            
            # Budget achievements
            {'name': 'Budget Conscious', 'description': 'Stay under budget for 1 week', 'type': 'budget', 'requirement': 1, 'icon': '💰', 'points': 20},
            {'name': 'Budget Hero', 'description': 'Stay under budget for 4 weeks', 'type': 'budget', 'requirement': 4, 'icon': '💎', 'points': 75},
            
            # Savings achievements
            {'name': 'Saver', 'description': 'Save $100 in a month', 'type': 'savings', 'requirement': 100, 'icon': '🐷', 'points': 30},
            {'name': 'Super Saver', 'description': 'Save $500 in a month', 'type': 'savings', 'requirement': 500, 'icon': '💵', 'points': 100},
        ]
        
        created_count = 0
        for ach in achievements:
            _, created = Achievement.objects.get_or_create(
                name=ach['name'],
                defaults={
                    'description': ach['description'],
                    'achievement_type': ach['type'],
                    'requirement_value': ach['requirement'],
                    'icon': ach['icon'],
                    'points': ach['points']
                }
            )
            if created:
                created_count += 1
        
        self.stdout.write(self.style.SUCCESS(f'Created {created_count} achievements'))