from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Count
from .models import UserStats, Achievement, UserAchievement

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_gamification_stats(request):
    """
    Get user's achievement statistics
    """
    user = request.user
    
    # Get or create user stats
    stats, _ = UserStats.objects.get_or_create(user=user)
    
    # Get achievements
    unlocked_achievements = UserAchievement.objects.filter(user=user).select_related('achievement')
    total_achievements = Achievement.objects.count()
    
    unlocked_list = [{
        'id': ua.achievement.id,
        'name': ua.achievement.name,
        'description': ua.achievement.description,
        'icon': ua.achievement.icon,
        'points': ua.achievement.points,
        'type': ua.achievement.achievement_type,
        'unlocked_at': ua.unlocked_at,
        'is_new': ua.is_new
    } for ua in unlocked_achievements]
    
    return Response({
        'total_points': stats.total_points,
        'achievements': {
            'unlocked': unlocked_list,
            'unlocked_count': len(unlocked_list),
            'total_count': total_achievements,
            'completion_percentage': (len(unlocked_list) / total_achievements * 100) if total_achievements > 0 else 0
        },
        'stats': {
            'total_categories_used': stats.total_categories_used,
            'days_active': stats.days_active
        }
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_all_achievements(request):
    """
    Get all available achievements with unlock status
    """
    user = request.user
    
    # Get all achievements
    all_achievements = Achievement.objects.all()
    
    # Get unlocked achievement IDs
    unlocked_ids = set(UserAchievement.objects.filter(user=user).values_list('achievement_id', flat=True))
    
    # Build response
    achievements_list = []
    for achievement in all_achievements:
        achievements_list.append({
            'id': achievement.id,
            'name': achievement.name,
            'description': achievement.description,
            'icon': achievement.icon,
            'points': achievement.points,
            'type': achievement.achievement_type,
            'requirement_value': achievement.requirement_value,
            'is_unlocked': achievement.id in unlocked_ids
        })
    
    # Group by type
    grouped = {}
    for achievement in achievements_list:
        achievement_type = achievement['type']
        if achievement_type not in grouped:
            grouped[achievement_type] = []
        grouped[achievement_type].append(achievement)
    
    return Response({
        'achievements': achievements_list,
        'grouped': grouped
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_achievements_seen(request):
    """
    Mark achievements as seen (remove 'NEW' badge)
    """
    user = request.user
    achievement_ids = request.data.get('achievement_ids', [])
    
    if not achievement_ids:
        # Mark all as seen
        UserAchievement.objects.filter(user=user, is_new=True).update(is_new=False)
    else:
        # Mark specific achievements as seen
        UserAchievement.objects.filter(
            user=user,
            achievement_id__in=achievement_ids,
            is_new=True
        ).update(is_new=False)
    
    return Response({'message': 'Achievements marked as seen'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_leaderboard(request):
    """
    Get leaderboard rankings by level and points
    """
    # Top users by level
    top_by_level = UserStats.objects.select_related('user').order_by('-level', '-total_points')[:10]
    
    level_leaderboard = [{
        'rank': idx + 1,
        'username': stat.user.username,
        'level': stat.level,
        'points': stat.total_points
    } for idx, stat in enumerate(top_by_level)]
    
    # Get current user's rank
    user_stats = UserStats.objects.get(user=request.user)
    user_rank = UserStats.objects.filter(
        level__gt=user_stats.level
    ).count() + UserStats.objects.filter(
        level=user_stats.level,
        total_points__gt=user_stats.total_points
    ).count() + 1
    
    return Response({
        'level_leaderboard': level_leaderboard,
        'your_rank': user_rank
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_new_achievements_count(request):
    """
    Get count of newly unlocked achievements
    """
    user = request.user
    new_count = UserAchievement.objects.filter(user=user, is_new=True).count()
    
    return Response({
        'new_achievements_count': new_count
    })