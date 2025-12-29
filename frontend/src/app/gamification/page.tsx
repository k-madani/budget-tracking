'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import Navbar from '@/components/Navbar';
import { Transaction } from '@/types';

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
  total_points: number;
  achievements: {
    unlocked: Achievement[];
    unlocked_count: number;
    total_count: number;
    completion_percentage: number;
  };
}

interface AchievementProgress {
  current: number;
  required: number;
  percentage: number;
}

export default function ProgressPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [allAchievements, setAllAchievements] = useState<Achievement[]>([]);
  const [progressData, setProgressData] = useState<Record<number, AchievementProgress>>({});

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetchData();
  }, [router]);

  const fetchData = async () => {
    try {
      const [statsRes, achievementsRes, transactionsRes, categoriesRes] = await Promise.all([
        api.get('/stats'),
        api.get('/achievements'),
        api.get('/transactions'),
        api.get('/categories')
      ]);
      
      setStats(statsRes.data);
      setAllAchievements(achievementsRes.data.achievements || []);
      
      // Calculate progress for each locked achievement
      const progress: Record<number, AchievementProgress> = {};
      const transactions = transactionsRes.data.results || [];
      const categories = categoriesRes.data || [];
      
      achievementsRes.data.achievements.forEach((ach: Achievement) => {
        if (!ach.is_unlocked && ach.requirement_value) {
          let current = 0;
          
          if (ach.type === 'transaction') {
            current = transactions.length;
          } else if (ach.type === 'category') {
            const uniqueCategories = new Set(transactions.map((t: any) => t.category).filter(Boolean));
            current = uniqueCategories.size;
          }
          
          progress[ach.id] = {
            current,
            required: ach.requirement_value,
            percentage: Math.min((current / ach.requirement_value) * 100, 100)
          };
        }
      });
      
      setProgressData(progress);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      if (error.response?.status === 401) {
        router.push('/login');
      } else {
        toast.error('Failed to load progress data');
      }
    } finally {
      setLoading(false);
    }
  };

  const getAchievementTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'transaction': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      'budget': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      'savings': 'bg-green-500/10 text-green-600 border-green-500/20',
      'category': 'bg-orange-500/10 text-orange-600 border-orange-500/20'
    };
    return colors[type] || 'bg-gray-500/10 text-gray-600 border-gray-500/20';
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

  if (!stats) return null;

  const unlockedAchievements = allAchievements.filter(a => a.is_unlocked);
  const lockedAchievements = allAchievements.filter(a => !a.is_unlocked);
  const newAchievements = unlockedAchievements.filter(a => a.is_new);

  return (
    <div className="min-h-screen bg-background">
      <Navbar currentPage="gamification" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-3">Your Progress</h1>
          <p className="text-lg text-muted-foreground">Track achievements and earn rewards</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-card border border-border rounded-2xl p-8 text-center hover:shadow-lg transition-shadow">
            <div className="text-6xl font-bold text-primary mb-3">{stats.total_points}</div>
            <div className="text-sm text-muted-foreground">Total Points Earned</div>
          </div>
          
          <div className="bg-card border border-border rounded-2xl p-8 text-center hover:shadow-lg transition-shadow">
            <div className="text-6xl font-bold text-green-500 mb-3">{unlockedAchievements.length}</div>
            <div className="text-sm text-muted-foreground">Achievements Unlocked</div>
          </div>
          
          <div className="bg-card border border-border rounded-2xl p-8 text-center hover:shadow-lg transition-shadow">
            <div className="text-6xl font-bold text-orange-500 mb-3">{stats.achievements.completion_percentage.toFixed(0)}%</div>
            <div className="text-sm text-muted-foreground">Completion Rate</div>
          </div>
        </div>

        {/* New Achievements Alert */}
        {newAchievements.length > 0 && (
          <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-2xl p-6 mb-12">
            <div className="flex items-center space-x-3">
              <span className="text-4xl">🎉</span>
              <div>
                <h3 className="text-xl font-bold text-foreground">New Achievements Unlocked!</h3>
                <p className="text-sm text-muted-foreground">You've earned {newAchievements.length} new badge{newAchievements.length > 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>
        )}

        {/* In Progress - Most Important Section */}
        {lockedAchievements.some(a => progressData[a.id]?.percentage > 0) && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center space-x-2">
              <span>🎯</span>
              <span>Almost There!</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {lockedAchievements
                .filter(a => progressData[a.id]?.percentage > 0)
                .sort((a, b) => (progressData[b.id]?.percentage || 0) - (progressData[a.id]?.percentage || 0))
                .map((achievement) => {
                  const progress = progressData[achievement.id];
                  return (
                    <div
                      key={achievement.id}
                      className="bg-card border-2 border-primary/30 rounded-2xl p-6 hover:shadow-xl transition-all"
                    >
                      <div className="flex items-start space-x-4 mb-4">
                        <div className="text-5xl">{achievement.icon}</div>
                        <div className="flex-1">
                          <h3 className="font-bold text-foreground mb-1">{achievement.name}</h3>
                          <p className="text-sm text-muted-foreground mb-3">{achievement.description}</p>
                          
                          {/* Progress Bar */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-foreground">
                                {progress.current} / {progress.required}
                              </span>
                              <span className="font-bold text-primary">
                                {progress.percentage.toFixed(0)}%
                              </span>
                            </div>
                            
                            <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                              <div
                                className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-500"
                                style={{ width: `${progress.percentage}%` }}
                              />
                            </div>
                            
                            <p className="text-xs text-muted-foreground">
                              {progress.required - progress.current} more to unlock +{achievement.points} pts
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Unlocked Achievements */}
        {unlockedAchievements.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center space-x-2">
              <span>🏆</span>
              <span>Unlocked Achievements</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {unlockedAchievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className="relative bg-card border-2 border-primary/50 rounded-2xl p-6 hover:shadow-xl transition-all"
                >
                  {achievement.is_new && (
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                      NEW
                    </div>
                  )}
                  
                  <div className="flex items-start space-x-4 mb-4">
                    <div className="text-5xl">{achievement.icon}</div>
                    <div className="flex-1">
                      <h3 className="font-bold text-foreground mb-1">{achievement.name}</h3>
                      <p className="text-sm text-muted-foreground">{achievement.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium px-3 py-1 rounded-full border ${getAchievementTypeColor(achievement.type)}`}>
                      {achievement.type}
                    </span>
                    <span className="text-sm font-bold text-primary">+{achievement.points} pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Locked Achievements - Lower Priority */}
        {lockedAchievements.filter(a => !progressData[a.id] || progressData[a.id].percentage === 0).length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center space-x-2">
              <span>🔒</span>
              <span>Locked Achievements</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {lockedAchievements
                .filter(a => !progressData[a.id] || progressData[a.id].percentage === 0)
                .map((achievement) => (
                  <div
                    key={achievement.id}
                    className="bg-card border-2 border-dashed border-border rounded-2xl p-6 opacity-50"
                  >
                    <div className="flex items-start space-x-4 mb-4">
                      <div className="text-5xl grayscale">{achievement.icon}</div>
                      <div className="flex-1">
                        <h3 className="font-bold text-foreground mb-1">{achievement.name}</h3>
                        <p className="text-sm text-muted-foreground">{achievement.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium px-3 py-1 rounded-full border ${getAchievementTypeColor(achievement.type)}`}>
                        {achievement.type}
                      </span>
                      <span className="text-sm font-bold text-muted-foreground">+{achievement.points} pts</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 text-center">
          <Link
            href="/transactions"
            className="inline-flex items-center space-x-2 px-8 py-4 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold transition-all shadow-lg hover:scale-105"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Add Transaction to Earn More</span>
          </Link>
        </div>
      </div>
    </div>
  );
}