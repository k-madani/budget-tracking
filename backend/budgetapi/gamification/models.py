from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class UserStreak(models.Model):
    """Track user's daily logging streaks"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='streak')
    current_streak = models.IntegerField(default=0)
    longest_streak = models.IntegerField(default=0)
    last_activity_date = models.DateField(null=True, blank=True)
    total_transactions = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - Streak: {self.current_streak}"

    class Meta:
        db_table = 'user_streaks'


class Achievement(models.Model):
    """Define available achievements"""
    ACHIEVEMENT_TYPES = [
        ('streak', 'Streak'),
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
    level = models.IntegerField(default=1)
    total_categories_used = models.IntegerField(default=0)
    days_active = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - Level {self.level}"

    def calculate_level(self):
        """
        Calculate level based on total points with realistic progression
        Level 1: 0-49 points (easy start - 7 day streak gets you here)
        Level 2: 50-149 points (2 weeks of activity)
        Level 3: 150-299 points (1 month of activity)
        Then increases by 200 points per level
        """
        if self.total_points < 50:
            return 1
        elif self.total_points < 150:
            return 2
        elif self.total_points < 300:
            return 3
        else:
            # After level 3, need 200 points per level
            return 3 + ((self.total_points - 300) // 200)
    
    def points_to_next_level(self):
        """Calculate points needed for next level"""
        current_level = self.calculate_level()
        
        if current_level == 1:
            return 50 - self.total_points
        elif current_level == 2:
            return 150 - self.total_points
        elif current_level == 3:
            return 300 - self.total_points
        else:
            # For levels 4+, calculate next milestone
            next_milestone = 300 + (current_level - 3) * 200
            return next_milestone - self.total_points

    class Meta:
        db_table = 'user_stats'