'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import Navbar from '@/components/Navbar';

interface Achievement {
  id: number;
  name: string;
  description: string;
  icon: string;
  points: number;
  type: string;
  requirement_value?: number;
  is_unlocked?: boolean;
  unlocked_at?: string;
  is_new?: boolean;
}

interface GamificationStats {
  streak: {
    current: number;
    longest: number;
    status: string;
    message: string;
  };
  level: {
    current: number;
    total_points: number;
    points_in_current_level: number;
    points_to_next_level: number;
    progress_percentage: number;
  };
  achievements: {
    unlocked: Achievement[];
    unlocked_count: number;
    total_count: number;
    completion_percentage: number;
  };
}

export default function GamificationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [allAchievements, setAllAchievements] = useState<Achievement[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'achievements'>('overview');

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetchGamificationData();
  }, [router]);

  const fetchGamificationData = async () => {
    try {
      const [statsRes, achievementsRes] = await Promise.all([
        api.get('/stats'),
        api.get('/achievements')
      ]);
      
      setStats(statsRes.data);
      setAllAchievements(achievementsRes.data.achievements || []);
    } catch (error: any) {
      console.error('Error fetching gamification data:', error);
      if (error.response?.status === 401) {
        router.push('/login');
      } else {
        toast.error('Failed to load gamification data');
      }
    } finally {
      setLoading(false);
    }
  };

  const getStreakColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 dark:text-green-400';
      case 'at_risk': return 'text-yellow-600 dark:text-yellow-400';
      case 'broken': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getAchievementTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'streak': 'Streak',
      'transaction': 'Transactions',
      'budget': 'Budget',
      'savings': 'Savings',
      'category': 'Categories'
    };
    return labels[type] || type;
  };

  const getLevelInfo = (level: number) => {
    if (level === 1) return { name: 'Beginner', color: 'text-gray-500', emoji: '🌱' };
    if (level === 2) return { name: 'Learner', color: 'text-blue-500', emoji: '📚' };
    if (level === 3) return { name: 'Tracker', color: 'text-green-500', emoji: '📊' };
    if (level < 6) return { name: 'Expert', color: 'text-purple-500', emoji: '⭐' };
    if (level < 10) return { name: 'Master', color: 'text-orange-500', emoji: '🏅' };
    return { name: 'Legend', color: 'text-yellow-500', emoji: '👑' };
  };

  const getNextAchievements = () => {
    if (!stats) return [];
    
    const unlocked = allAchievements.filter(a => a.is_unlocked);
    const locked = allAchievements.filter(a => !a.is_unlocked);
    
    // Calculate progress for each locked achievement
    const withProgress = locked.map(achievement => {
      let currentValue = 0;
      let progress = 0;

      if (achievement.type === 'streak') {
        currentValue = stats.streak.current;
      } else if (achievement.type === 'transaction') {
        currentValue = stats.achievements.unlocked.length > 0 
          ? stats.achievements.unlocked[0].id  // This is a placeholder
          : 0;
      }

      progress = achievement.requirement_value ? (currentValue / achievement.requirement_value) * 100 : 0;

      return { ...achievement, currentValue, progress: Math.min(progress, 100) };
    });

    // Sort by progress (closest first) and return top 3
    return withProgress
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 3);
  };

  const getLevelRoadmap = () => {
    if (!stats) return [];
    
    const currentLevel = stats.level.current;
    const levels = [];
    
    for (let i = Math.max(1, currentLevel - 1); i <= currentLevel + 3; i++) {
      let pointsRequired = 0;
      if (i === 1) pointsRequired = 0;
      else if (i === 2) pointsRequired = 50;
      else if (i === 3) pointsRequired = 150;
      else pointsRequired = 300 + (i - 4) * 200;

      const levelInfo = getLevelInfo(i);
      
      levels.push({
        level: i,
        points: pointsRequired,
        ...levelInfo,
        isCurrent: i === currentLevel,
        isUnlocked: i <= currentLevel
      });
    }
    
    return levels;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your progress...</p>
        </div>
      </div>
    );
  }

  const nextAchievements = getNextAchievements();
  const levelRoadmap = getLevelRoadmap();
  const currentLevelInfo = stats ? getLevelInfo(stats.level.current) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <Navbar currentPage="gamification" />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">Your Progress</h1>
            <p className="text-muted-foreground">Track your journey to financial mastery</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-card border border-border rounded-xl p-2 mb-8 inline-flex">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'overview'
                ? 'bg-primary text-white'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('achievements')}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'achievements'
                ? 'bg-primary text-white'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All Achievements
          </button>
        </div>

        {activeTab === 'overview' && stats && (
          <div className="space-y-8">
            {/* Current Level Highlight */}
            {currentLevelInfo && (
              <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/30 rounded-xl p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="text-5xl">{currentLevelInfo.emoji}</span>
                      <div>
                        <div className="text-sm text-muted-foreground">Current Level</div>
                        <div className="flex items-baseline space-x-2">
                          <span className="text-4xl font-bold text-foreground">{stats.level.current}</span>
                          <span className={`text-xl font-semibold ${currentLevelInfo.color}`}>{currentLevelInfo.name}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{stats.level.total_points} total points earned</p>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground mb-1">Next Level</div>
                    <div className="text-2xl font-bold text-primary">{stats.level.points_to_next_level} pts</div>
                    <div className="text-xs text-muted-foreground">to reach</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Level Progress</span>
                    <span className="font-medium text-foreground">{stats.level.progress_percentage.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-4 bg-background/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500 rounded-full"
                      style={{ width: `${stats.level.progress_percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Streak Card */}
              <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Current Streak</h3>
                  <span className="text-3xl">🔥</span>
                </div>
                <div className="text-center">
                  <div className={`text-5xl font-bold mb-2 ${getStreakColor(stats.streak.status)}`}>
                    {stats.streak.current}
                  </div>
                  <div className="text-sm text-muted-foreground mb-4">
                    {stats.streak.current === 1 ? 'day' : 'days'}
                  </div>
                  <div className={`text-sm font-medium ${getStreakColor(stats.streak.status)} px-3 py-1 bg-background rounded-full`}>
                    {stats.streak.message}
                  </div>
                  {stats.streak.longest > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="text-xs text-muted-foreground">Best Streak</div>
                      <div className="text-2xl font-bold text-foreground">{stats.streak.longest} days</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Achievements Card */}
              <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Achievements</h3>
                  <span className="text-3xl">🏆</span>
                </div>
                <div className="text-center">
                  <div className="text-5xl font-bold text-primary mb-2">
                    {stats.achievements.unlocked_count}
                  </div>
                  <div className="text-sm text-muted-foreground mb-4">
                    of {stats.achievements.total_count} unlocked
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{stats.achievements.completion_percentage.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3">
                      <div
                        className="bg-primary h-3 rounded-full transition-all duration-500"
                        style={{ width: `${stats.achievements.completion_percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Points Card */}
              <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Total Points</h3>
                  <span className="text-3xl">⭐</span>
                </div>
                <div className="text-center">
                  <div className="text-5xl font-bold text-primary mb-2">
                    {stats.level.total_points}
                  </div>
                  <div className="text-sm text-muted-foreground mb-4">
                    points earned
                  </div>
                  <Link
                    href="/transactions"
                    className="inline-block px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors text-sm font-medium"
                  >
                    Earn More Points
                  </Link>
                </div>
              </div>
            </div>

            {/* Level Roadmap */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-6">Level Roadmap</h3>
              <div className="space-y-4">
                {levelRoadmap.map((level, index) => (
                  <div key={level.level} className="flex items-center space-x-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl ${
                      level.isUnlocked ? 'bg-primary/20' : 'bg-muted'
                    } ${level.isCurrent ? 'ring-4 ring-primary ring-offset-2 ring-offset-background' : ''}`}>
                      {level.emoji}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <span className="font-semibold text-foreground">Level {level.level}</span>
                          <span className={`ml-2 text-sm ${level.color}`}>{level.name}</span>
                          {level.isCurrent && (
                            <span className="ml-2 text-xs bg-primary text-white px-2 py-0.5 rounded">Current</span>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">{level.points}+ pts</span>
                      </div>
                      {!level.isUnlocked && !level.isCurrent && (
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="w-0 bg-primary h-2 rounded-full"></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Next to Unlock */}
            {nextAchievements.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-foreground">Almost There! 🎯</h3>
                  <button
                    onClick={() => setActiveTab('achievements')}
                    className="text-sm text-primary hover:underline font-medium"
                  >
                    View All
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {nextAchievements.map((achievement) => (
                    <div key={achievement.id} className="p-4 bg-background rounded-lg border border-border">
                      <div className="flex items-start space-x-3 mb-3">
                        <span className="text-3xl opacity-50 grayscale">{achievement.icon}</span>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-foreground text-sm">{achievement.name}</h4>
                          <p className="text-xs text-muted-foreground mt-1">{achievement.description}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium text-foreground">
                            {achievement.currentValue}/{achievement.requirement_value}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-500"
                            style={{ width: `${achievement.progress}%` }}
                          />
                        </div>
                        <div className="text-xs text-primary font-medium">+{achievement.points} pts reward</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Achievements */}
            {stats.achievements.unlocked.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="text-lg font-semibold text-foreground mb-6">Recent Achievements</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stats.achievements.unlocked.slice(0, 6).map((achievement) => (
                    <div
                      key={achievement.id}
                      className="flex items-start space-x-3 p-4 bg-background rounded-lg hover:bg-muted/50 transition-colors border border-primary/20"
                    >
                      <span className="text-3xl">{achievement.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-semibold text-foreground text-sm">{achievement.name}</h4>
                          {achievement.is_new && (
                            <span className="text-xs bg-primary text-white px-2 py-0.5 rounded">NEW</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{achievement.description}</p>
                        <div className="text-xs text-primary font-medium mt-2">+{achievement.points} pts</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="space-y-6">
            {Object.entries(
              allAchievements.reduce((acc, achievement) => {
                const type = achievement.type;
                if (!acc[type]) acc[type] = [];
                acc[type].push(achievement);
                return acc;
              }, {} as Record<string, Achievement[]>)
            ).map(([type, achievements]) => (
              <div key={type} className="bg-card border border-border rounded-xl p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  {getAchievementTypeLabel(type)} Achievements
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {achievements.map((achievement) => (
                    <div
                      key={achievement.id}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        achievement.is_unlocked
                          ? 'border-primary bg-primary/5'
                          : 'border-border opacity-50 grayscale'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <span className="text-3xl">{achievement.icon}</span>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-foreground text-sm">{achievement.name}</h4>
                          <p className="text-xs text-muted-foreground mt-1">{achievement.description}</p>
                          <div className="flex items-center justify-between mt-3">
                            <div className="text-xs text-primary font-medium">+{achievement.points} pts</div>
                            {achievement.is_unlocked ? (
                              <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded font-medium">
                                ✓ Unlocked
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {achievement.requirement_value} needed
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}