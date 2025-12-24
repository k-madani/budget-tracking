'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import Navbar from '@/components/Navbar';

interface Transaction {
  id: string;
  amount: string;
  currency: string;
  note: string;
  spent_at: string;
  category: string | null;
  category_name?: string;
  category_type?: 'INCOME' | 'EXPENSE';
}

interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  budget_limit?: number | null;
  current_spending?: number;
}

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

export default function DashboardPage() {
  const router = useRouter();
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [level, setLevel] = useState<LevelData | null>(null);

  const [balance, setBalance] = useState(0);
  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetchDashboardData();
  }, [router]);


  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const [summaryRes, transactionsRes, categoriesRes, gamificationRes] = await Promise.all([
        api.get('/transactions/summary'),
        api.get('/transactions'),
        api.get('/categories'),
        api.get('/stats').catch(() => null)
      ]);

      if (summaryRes.data) {
        setBalance(summaryRes.data.balance || 0);
        setIncome(summaryRes.data.income || 0);
        setExpenses(summaryRes.data.expense || 0);
      }

      const allTxns = transactionsRes.data.results || transactionsRes.data || [];
      setAllTransactions(allTxns);
      setRecentTransactions(allTxns.slice(0, 3));

      setCategories(categoriesRes.data || []);

      if (gamificationRes?.data) {
        setStreak(gamificationRes.data.streak);
        setLevel(gamificationRes.data.level);
      }

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
      
      if (error.response?.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  }; 

  const getSmartInsights = () => {
    const insights = [];
    
    if (streak && streak.current > 0) {
      insights.push({
        icon: '🔥',
        text: `${streak.current}-day logging streak! Keep it up!`,
        type: 'positive'
      });
    }
    
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
    if (savingsRate >= 20) {
      insights.push({
        icon: '💰',
        text: `You're saving ${savingsRate.toFixed(0)}% of your income`,
        type: 'positive'
      });
    } else if (savingsRate < 10 && income > 0) {
      insights.push({
        icon: '⚠️',
        text: `Low savings rate: ${savingsRate.toFixed(0)}%. Consider reducing expenses`,
        type: 'warning'
      });
    }
    
    if (level && level.points_to_next_level > 0) {
      insights.push({
        icon: '⭐',
        text: `Level ${level.current} - ${level.points_to_next_level} points to next level`,
        type: 'info'
      });
    }
    
    return insights.slice(0, 3);
  };

  const getWeeklySpending = () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const thisWeek = allTransactions
      .filter(t => t.category_type === 'EXPENSE' && new Date(t.spent_at) >= sevenDaysAgo)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const lastWeek = allTransactions
      .filter(t => t.category_type === 'EXPENSE' && new Date(t.spent_at) >= fourteenDaysAgo && new Date(t.spent_at) < sevenDaysAgo)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const change = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : 0;

    const dailyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const daySpending = allTransactions
        .filter(t => t.category_type === 'EXPENSE' && t.spent_at.split('T')[0] === dateStr)
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      dailyData.push(daySpending);
    }

    return { thisWeek, lastWeek, change, dailyData };
  };

  const getBudgetHealth = () => {
    return categories
      .filter(cat => cat.type === 'EXPENSE' && cat.budget_limit)
      .map(cat => {
        const budgetLimit = Number(cat.budget_limit) || 0;
        const currentSpending = Number(cat.current_spending) || 0;
        const percentage = budgetLimit > 0 ? (currentSpending / budgetLimit) * 100 : 0;
        
        return {
          name: cat.name,
          spent: currentSpending,
          budget: budgetLimit,
          percentage,
          status: percentage >= 100 ? 'over' : percentage >= 80 ? 'warning' : 'good'
        };
      })
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 2);
  };

  const insights = getSmartInsights();
  const weeklySpending = getWeeklySpending();
  const budgetHealth = getBudgetHealth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar currentPage="dashboard" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">Dashboard</h1>
            <p className="text-muted-foreground">Your financial overview</p>
          </div>
          <Link
            href="/transactions"
            className="inline-flex items-center space-x-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition-colors shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Transaction</span>
          </Link>
        </div>

        {/* Summary Cards with Effects */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg hover:border-primary/50 hover:-translate-y-1 transition-all duration-200 group">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">${balance.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Current Balance</div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg hover:border-green-500/50 hover:-translate-y-1 transition-all duration-200 group">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">${income.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Total Income</div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg hover:border-red-500/50 hover:-translate-y-1 transition-all duration-200 group">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">${expenses.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Total Expenses</div>
              </div>
            </div>
          </div>
        </div>

        {/* Smart Insights with Effects */}
        {insights.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-6 mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">Smart Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {insights.map((insight, index) => (
                <div 
                  key={index} 
                  className="flex items-center space-x-3 p-4 bg-background rounded-lg border border-border hover:border-primary hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-default group"
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform duration-200">{insight.icon}</span>
                  <p className="text-sm text-foreground flex-1 font-medium">{insight.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Spending & Budget */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* This Week's Spending with Effects */}
          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground">This Week's Spending</h2>
              <Link href="/analytics" className="text-sm text-primary hover:underline font-medium">
                Details
              </Link>
            </div>
            
            <div className="mb-6">
              <div className="flex items-baseline space-x-3 mb-2">
                <span className="text-4xl font-bold text-foreground">${weeklySpending.thisWeek.toFixed(2)}</span>
                {weeklySpending.lastWeek > 0 && (
                  <div className={`flex items-center space-x-1 px-3 py-1 rounded-full ${
                    weeklySpending.change > 0 ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'
                  }`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={
                        weeklySpending.change > 0 ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"
                      } />
                    </svg>
                    <span className="text-sm font-bold">{Math.abs(weeklySpending.change).toFixed(0)}%</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                vs ${weeklySpending.lastWeek.toFixed(2)} last week
              </p>
            </div>

            {/* Mini Chart with Tooltips */}
            <div className="relative">
              <div className="flex items-end justify-between gap-2 h-32 bg-background/50 rounded-lg p-3">
                {weeklySpending.dailyData.map((value, index) => {
                  const maxValue = Math.max(...weeklySpending.dailyData, 1);
                  const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
                  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                  
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center group relative h-full">
                      <div className="w-full h-full flex items-end justify-center">
                        {value > 0 ? (
                          <div 
                            className="w-full bg-primary rounded-t hover:bg-primary/80 transition-all duration-200 cursor-pointer relative"
                            style={{ height: `${Math.max(height, 10)}%` }}
                          >
                            {/* Tooltip */}
                            <div className="opacity-0 group-hover:opacity-100 absolute -top-14 left-1/2 -translate-x-1/2 bg-foreground text-background px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-opacity shadow-lg z-10">
                              <div className="text-center mb-0.5">{days[index]}</div>
                              <div className="text-center font-bold">${value.toFixed(2)}</div>
                              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-foreground rotate-45" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-2 bg-muted/30 rounded-full mb-1" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-3 px-3">
                <span>M</span>
                <span>T</span>
                <span>W</span>
                <span>T</span>
                <span>F</span>
                <span>S</span>
                <span>S</span>
              </div>
            </div>
          </div>

          {/* Budget Health with Enhanced Effects */}
          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground">Budget Health</h2>
              <Link href="/categories" className="text-sm text-primary hover:underline font-medium">
                Manage
              </Link>
            </div>

            {budgetHealth.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-sm text-muted-foreground mb-2">No budget limits set</p>
                <Link href="/categories" className="text-sm text-primary hover:underline">
                  Set budget limits
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {budgetHealth.map((item, index) => (
                  <div 
                    key={index} 
                    className="p-4 bg-background rounded-lg border border-border hover:border-primary/50 hover:shadow-md transition-all duration-200 group"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200 ${
                          item.status === 'over' 
                            ? 'bg-red-500/10'
                            : item.status === 'warning'
                            ? 'bg-yellow-500/10'
                            : 'bg-green-500/10'
                        }`}>
                          <svg className={`w-5 h-5 ${
                            item.status === 'over' 
                              ? 'text-red-500'
                              : item.status === 'warning'
                              ? 'text-yellow-500'
                              : 'text-green-500'
                          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{item.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            ${item.spent.toFixed(2)} of ${item.budget.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                        item.status === 'over' 
                          ? 'bg-red-500/10 text-red-500'
                          : item.status === 'warning'
                          ? 'bg-yellow-500/10 text-yellow-500'
                          : 'bg-green-500/10 text-green-500'
                      }`}>
                        {item.percentage.toFixed(0)}%
                      </div>
                    </div>
                    
                    <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-700 ease-out ${
                          item.status === 'over' 
                            ? 'bg-red-500'
                            : item.status === 'warning'
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(item.percentage, 100)}%` }}
                      />
                    </div>
                    
                    {item.status === 'over' && (
                      <div className="flex items-center space-x-1 text-red-500 mt-2 animate-pulse">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-xs font-semibold">
                          Over budget by ${(item.spent - item.budget).toFixed(2)}
                        </p>
                      </div>
                    )}
                    {item.status === 'warning' && (
                      <p className="text-xs text-yellow-500 mt-2 flex items-center font-medium">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        ${(item.budget - item.spent).toFixed(2)} remaining
                      </p>
                    )}
                    {item.status === 'good' && (
                      <p className="text-xs text-green-500 mt-2 flex items-center font-medium">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        On track - ${(item.budget - item.spent).toFixed(2)} left
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions with Effects */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">Recent Activity</h2>
            <Link 
              href="/transactions"
              className="text-sm text-primary hover:underline font-medium"
            >
              View all
            </Link>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-muted-foreground mb-4">No transactions yet</p>
              <Link 
                href="/transactions"
                className="text-sm text-primary hover:underline font-medium"
              >
                Add your first transaction
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((transaction) => (
                <div 
                  key={transaction.id} 
                  className="flex items-center justify-between p-4 bg-background rounded-lg hover:bg-muted/50 hover:shadow-md hover:scale-[1.01] transition-all duration-200 group"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200 ${
                      transaction.category_type === 'INCOME' ? 'bg-green-500/10' : 'bg-red-500/10'
                    }`}>
                      <svg className={`w-5 h-5 ${
                        transaction.category_type === 'INCOME' ? 'text-green-500' : 'text-red-500'
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={
                          transaction.category_type === 'INCOME' 
                            ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                            : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
                        } />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">
                        {transaction.category_name || 'Uncategorized'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(transaction.spent_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className={`text-lg font-semibold ${
                    transaction.category_type === 'INCOME' ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {transaction.category_type === 'INCOME' ? '+' : '-'}${parseFloat(transaction.amount).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}