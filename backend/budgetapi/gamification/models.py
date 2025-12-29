from django.db import models
from django.contrib.auth.models import User
class Achievement(models.Model):
    """Define available achievements"""
    ACHIEVEMENT_TYPES = [
        ('transaction', 'Transaction Count'),
        ('budget', 'Budget Related'),
        ('savings', 'Savings Related'),
        ('category', 'Category Related'),
    ]
    
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField()
    achievement_type = models.CharField(max_length=20, choices=ACHIEVEMENT_TYPES)
    requirement_value = models.IntegerField(help_text="Value needed to unlock")
    icon = models.CharField(max_length=50, help_text="Emoji or icon name")
    points = models.IntegerField(default=10)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.achievement_type})"

    class Meta:
        db_table = 'achievements'
        ordering = ['achievement_type', 'requirement_value']

class UserAchievement(models.Model):
    """Track which achievements users have unlocked"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='achievements')
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE)
    unlocked_at = models.DateTimeField(auto_now_add=True)
    is_new = models.BooleanField(default=True, help_text="Show 'NEW' badge")

    def __str__(self):
        return f"{self.user.username} - {self.achievement.name}"

    class Meta:
        db_table = 'user_achievements'
        unique_together = ['user', 'achievement']
        ordering = ['-unlocked_at']

class UserStats(models.Model):
    """Track overall user statistics"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='stats')
    total_points = models.IntegerField(default=0)

    total_categories_used = models.IntegerField(default=0)
    days_active = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - {self.total_points} points"

    class Meta:
        db_table = 'user_stats'