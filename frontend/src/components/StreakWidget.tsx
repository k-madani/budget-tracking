'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

interface StreakData {
  current: number;
  longest: number;
  status: string;
  message: string;
}

interface LevelData {
  current: number;
  total_points: number;
  points_to_next_level: number;
  progress_percentage: number;
}

export default function StreakWidget() {
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [level, setLevel] = useState<LevelData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStreakData();
  }, []);

  const fetchStreakData = async () => {
    try {
      const response = await api.get('/stats');
      setStreak(response.data.streak);
      setLevel(response.data.level);
    } catch (error) {
      console.error('Error fetching streak data:', error);
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

  const getStreakEmoji = (status: string) => {
    switch (status) {
      case 'active': return '🔥';
      case 'at_risk': return '⚠️';
      case 'broken': return '💔';
      default: return '🎯';
    }
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-1/2"></div>
          <div className="h-12 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!streak || !level) {
    return null;
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center">
          <span className="mr-2">{getStreakEmoji(streak.status)}</span>
          Your Progress
        </h3>
        <Link href="/gamification" className="text-sm text-primary hover:underline font-medium">
          View All →
        </Link>
      </div>

      {/* Streak Section */}
      <div className="mb-4 pb-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Current Streak</span>
          <span className={`text-2xl font-bold ${getStreakColor(streak.status)}`}>
            {streak.current} 🔥
          </span>
        </div>
        <p className={`text-xs ${getStreakColor(streak.status)}`}>
          {streak.message}
        </p>
        {streak.longest > streak.current && (
          <p className="text-xs text-muted-foreground mt-2">
            Best: {streak.longest} days
          </p>
        )}
      </div>

      {/* Level Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Level {level.current}</span>
          <span className="text-xs text-muted-foreground">
            {level.points_to_next_level} pts to next
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-500"
            style={{ width: `${level.progress_percentage}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">
            {level.total_points} total points
          </span>
          <span className="text-xs font-medium text-primary">
            {level.progress_percentage.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Quick Action */}
      <Link
        href="/transactions"
        className="mt-4 w-full block text-center px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors text-sm font-medium"
      >
        Log Transaction to Continue Streak
      </Link>
    </div>
  );
}