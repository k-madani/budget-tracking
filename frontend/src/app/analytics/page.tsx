'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import Link from 'next/link';
import api from '@/lib/api';
import { clearAuth } from '@/lib/authSlice';
import { toast } from 'react-hot-toast';
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/exportUtils';
import Navbar from '@/components/Navbar';
import { LineChart, Line, PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { toPng } from 'html-to-image';

interface Transaction {
    id: string;
    amount: string;
    currency: string;
    note: string;
    spent_at: string;
    category: string | null;
    category_name?: string;
    category_type?: 'INCOME' | 'EXPENSE';
    created_at: string;
    updated_at: string;
}

interface Category {
    id: string;
    name: string;
    type: 'INCOME' | 'EXPENSE';
    budget_limit?: number | null;
    current_spending?: number;
}

interface Summary {
    income: number;
    expense: number;
    balance: number;
}

interface TransactionResponse {
    count: number;
    results: Transaction[];
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

export default function AnalyticsPage() {
    const router = useRouter();
    const dispatch = useDispatch();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    const [timeRange, setTimeRange] = useState<'7days' | '30days' | 'all'>('30days');
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [expandedInsight, setExpandedInsight] = useState<number | null>(null);

    // Chart refs for downloading as PNG
    const spendingTrendRef = useRef<HTMLDivElement>(null);
    const expenseDistRef = useRef<HTMLDivElement>(null);
    const budgetVsActualRef = useRef<HTMLDivElement>(null);
    const incomeExpenseRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (!token) {
            router.push('/login');
            return;
        }

        const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        const initialTheme = savedTheme || systemTheme;

        setTheme(initialTheme);
        document.documentElement.classList.toggle('dark', initialTheme === 'dark');

        fetchData();
    }, [router]);

    const fetchData = async () => {
        try {
            setLoading(true);

            const [summaryRes, transactionsRes, categoriesRes] = await Promise.all([
                api.get('/transactions/summary'),
                api.get('/transactions'),
                api.get('/categories')
            ]);

            setSummary(summaryRes.data);

            const transactionData = transactionsRes.data as TransactionResponse;
            setTransactions(transactionData.results || []);

            setCategories(categoriesRes.data.results || []);
        } catch (error: any) {
            toast.error('Failed to load analytics data');
            if (error.response?.status === 401) {
                router.push('/login');
            }
        } finally {
            setLoading(false);
        }
    };

    const downloadChart = async (
        ref: React.RefObject<HTMLDivElement | null>,
        filename: string
    ) => {
        if (!ref.current) {
            toast.error('Chart not ready');
            return;
        }

        try {
            const dataUrl = await toPng(ref.current, {
                backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                pixelRatio: 2,
                cacheBust: true,
            });

            const link = document.createElement('a');
            link.download = `${filename}-${new Date().toISOString().split('T')[0]}.png`;
            link.href = dataUrl;
            link.click();

            toast.success('Chart downloaded');
        } catch (err) {
            toast.error('Failed to download chart');
        }
    };

    const handleExportCSV = () => {
        try {
            const filtered = getFilteredTransactions();
            if (filtered.length === 0) {
                toast.error('No data to export');
                return;
            }

            const headers = ['Date', 'Type', 'Category', 'Note', 'Amount', 'Currency'];
            const rows = filtered.map(t => [
                new Date(t.spent_at).toLocaleDateString(),
                t.category_type || 'N/A',
                t.category_name || 'Uncategorized',
                t.note || '',
                t.amount,
                t.currency
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            link.setAttribute('href', url);
            link.setAttribute('download', `budgetly_analytics_${timeRange}_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success('Analytics exported successfully');
        } catch (error) {
            toast.error('Failed to export data');
        }
    };

    const getFilteredTransactions = () => {
        if (timeRange === 'all') return transactions;

        const now = new Date();
        const days = timeRange === '7days' ? 7 : 30;
        const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        return transactions.filter(t => new Date(t.spent_at) >= cutoff);
    };

    const getSpendingTrendData = () => {
        const filtered = getFilteredTransactions();
        const days = timeRange === '7days' ? 7 : timeRange === '30days' ? 30 : 90;
        const trendData = [];
        const today = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            const dayTransactions = filtered.filter(t =>
                t.spent_at.split('T')[0] === dateStr
            );

            const dayIncome = dayTransactions
                .filter(t => t.category_type === 'INCOME')
                .reduce((sum, t) => sum + parseFloat(t.amount), 0);

            const dayExpenses = dayTransactions
                .filter(t => t.category_type === 'EXPENSE')
                .reduce((sum, t) => sum + parseFloat(t.amount), 0);

            trendData.push({
                date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                Income: dayIncome,
                Expenses: dayExpenses,
            });
        }

        return trendData;
    };

    const getCategoryBreakdown = () => {
        const filtered = getFilteredTransactions();

        const breakdown = categories
            .filter(cat => cat.type === 'EXPENSE')
            .map(cat => {
                const categoryTransactions = filtered.filter(
                    t => t.category === cat.id && t.category_type === 'EXPENSE'
                );
                const total = categoryTransactions.reduce(
                    (sum, t) => sum + parseFloat(t.amount),
                    0
                );

                return {
                    name: cat.name,
                    value: total,
                };
            })
            .filter(item => item.value > 0)
            .sort((a, b) => b.value - a.value);

        if (breakdown.length > 5) {
            const top5 = breakdown.slice(0, 5);
            const other = breakdown.slice(5).reduce((sum, item) => sum + item.value, 0);

            if (other > 0) {
                top5.push({ name: 'Other', value: other });
            }

            return top5;
        }

        return breakdown;
    };

    const getIncomeExpenseData = () => {
        const filtered = getFilteredTransactions();

        const totalIncome = filtered
            .filter(t => t.category_type === 'INCOME')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        const totalExpenses = filtered
            .filter(t => t.category_type === 'EXPENSE')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        return [
            { name: 'Income', amount: totalIncome },
            { name: 'Expenses', amount: totalExpenses },
        ];
    };

    const getBudgetVsActual = () => {
        return categories
            .filter(cat => cat.type === 'EXPENSE' && cat.budget_limit)
            .map(cat => {
                const budgetLimit = Number(cat.budget_limit) || 0;
                const currentSpending = Number(cat.current_spending) || 0;

                return {
                    category: cat.name,
                    Budget: budgetLimit,
                    Actual: currentSpending,
                };
            })
            .sort((a, b) => b.Actual - a.Actual)
            .slice(0, 6);
    };

    const detectSubscriptions = () => {
        const subscriptionKeywords = [
            'netflix', 'spotify', 'hulu', 'disney', 'prime', 'subscription',
            'membership', 'monthly', 'annual', 'gym', 'insurance', 'internet',
            'phone', 'rent', 'utilities', 'electric', 'water', 'gas'
        ];

        const potentialSubscriptions = new Map<string, Transaction[]>();

        transactions.forEach(t => {
            if (t.category_type !== 'EXPENSE') return;

            const note = t.note?.toLowerCase() || '';
            const isKeywordMatch = subscriptionKeywords.some(keyword => note.includes(keyword));

            if (isKeywordMatch) {
                const key = `${t.category_name}-${parseFloat(t.amount).toFixed(2)}`;
                if (!potentialSubscriptions.has(key)) {
                    potentialSubscriptions.set(key, []);
                }
                potentialSubscriptions.get(key)!.push(t);
            }
        });

        const subscriptions: Array<{
            name: string;
            amount: number;
            frequency: number;
            category: string;
            lastCharge: string;
        }> = [];

        potentialSubscriptions.forEach((txList, key) => {
            if (txList.length >= 2) {
                const latest = txList.sort((a, b) =>
                    new Date(b.spent_at).getTime() - new Date(a.spent_at).getTime()
                )[0];

                subscriptions.push({
                    name: latest.note || latest.category_name || 'Unknown',
                    amount: parseFloat(latest.amount),
                    frequency: txList.length,
                    category: latest.category_name || 'Uncategorized',
                    lastCharge: latest.spent_at,
                });
            }
        });

        return subscriptions.sort((a, b) => b.amount - a.amount);
    };

    const generateDynamicInsights = () => {
        const filtered = getFilteredTransactions();
        const totalIncome = filtered.filter(t => t.category_type === 'INCOME').reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const totalExpenses = filtered.filter(t => t.category_type === 'EXPENSE').reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const netSavings = totalIncome - totalExpenses;
        const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;
        
        const categoryBreakdown = getCategoryBreakdown();
        const topCategory = categoryBreakdown[0];
        const budgetVsActual = getBudgetVsActual();
        const overBudgetCategories = budgetVsActual.filter(cat => cat.Actual > cat.Budget);
        
        const dayOfWeekSpending = [0, 0, 0, 0, 0, 0, 0];
        filtered.forEach(t => {
            if (t.category_type === 'EXPENSE') {
                const day = new Date(t.spent_at).getDay();
                dayOfWeekSpending[day] += parseFloat(t.amount);
            }
        });
        const maxDayIndex = dayOfWeekSpending.indexOf(Math.max(...dayOfWeekSpending));
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const highestSpendingDay = days[maxDayIndex];
        
        let trendDirection = 'stable';
        let trendPercentage = 0;
        if (timeRange === '30days' && filtered.length > 0) {
            const now = new Date();
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
            
            const lastWeek = filtered.filter(t => 
                t.category_type === 'EXPENSE' && 
                new Date(t.spent_at) >= sevenDaysAgo
            ).reduce((sum, t) => sum + parseFloat(t.amount), 0);
            
            const previousWeek = filtered.filter(t => 
                t.category_type === 'EXPENSE' && 
                new Date(t.spent_at) >= fourteenDaysAgo && 
                new Date(t.spent_at) < sevenDaysAgo
            ).reduce((sum, t) => sum + parseFloat(t.amount), 0);
            
            if (previousWeek > 0) {
                trendPercentage = ((lastWeek - previousWeek) / previousWeek) * 100;
                if (Math.abs(trendPercentage) > 10) {
                    trendDirection = trendPercentage > 0 ? 'increasing' : 'decreasing';
                }
            }
        }
        
        const largestExpense = filtered
            .filter(t => t.category_type === 'EXPENSE')
            .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))[0];
        
        return {
            totalIncome,
            totalExpenses,
            netSavings,
            savingsRate,
            topCategory,
            overBudgetCategories,
            highestSpendingDay,
            trendDirection,
            trendPercentage,
            largestExpense
        };
    };

    const CustomLineTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const activeData = payload.find((p: any) => p.value > 0);
            if (!activeData) return null;

            return (
                <div className="bg-card/95 backdrop-blur-sm border-2 border-border rounded-xl p-3 shadow-xl">
                    <p className="text-foreground font-semibold text-sm mb-1">
                        {label}
                    </p>
                    <p className="text-xs font-semibold" style={{ color: activeData.color }}>
                        {activeData.name}: ${activeData.value.toFixed(2)}
                    </p>
                </div>
            );
        }
        return null;
    };

    const CustomBudgetTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length > 0) {
            const data = payload[0];

            return (
                <div className="bg-card/95 backdrop-blur-sm border-2 border-border rounded-xl p-3 shadow-xl">
                    <p className="text-foreground font-semibold text-sm mb-1">
                        {data.payload.category}
                    </p>
                    <p className="text-xs font-semibold" style={{ color: data.fill }}>
                        {data.dataKey}: ${data.value.toFixed(2)}
                    </p>
                </div>
            );
        }
        return null;
    };

    const CustomIncomeExpenseTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length > 0) {
            const data = payload[0];

            return (
                <div className="bg-card/95 backdrop-blur-sm border-2 border-border rounded-xl p-3 shadow-xl">
                    <p className="text-foreground font-semibold text-sm mb-1">
                        {data.payload.name}
                    </p>
                    <p className="text-lg font-bold" style={{ color: data.fill }}>
                        ${data.value.toFixed(2)}
                    </p>
                </div>
            );
        }
        return null;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading analytics...</p>
                </div>
            </div>
        );
    }

    const categoryBreakdown = getCategoryBreakdown();
    const budgetVsActual = getBudgetVsActual();
    const incomeExpenseData = getIncomeExpenseData();
    const spendingTrend = getSpendingTrendData();
    const subscriptions = detectSubscriptions();
    const totalSubscriptionCost = subscriptions.reduce((sum, sub) => sum + sub.amount, 0);
    const insights = generateDynamicInsights();

    // Reusable download icon button
    const DownloadButton = ({ chartRef, filename }: { chartRef: React.RefObject<HTMLDivElement | null>; filename: string }) => (
        <button
            onClick={() => downloadChart(chartRef, filename)}
            className="flex-shrink-0 p-2 rounded-lg bg-muted/50 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
            title="Download chart as PNG"
        >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
        </button>
    );

    return (
        <div className="min-h-screen bg-background">
            <Navbar currentPage="analytics" />

            <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground mb-1">Analytics</h1>
                        <p className="text-muted-foreground">Detailed insights into your spending</p>
                    </div>

                    <div className="flex items-center space-x-3">
                        <button
                            onClick={handleExportCSV}
                            disabled={transactions.length === 0}
                            className="px-4 py-2.5 bg-card/80 backdrop-blur-sm border-2 border-border text-foreground font-medium rounded-xl hover:shadow-lg transition-all hover:-translate-y-0.5 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>Export CSV</span>
                        </button>

                        <div className="flex items-center space-x-2 bg-card/80 backdrop-blur-sm border-2 border-border rounded-xl p-1">
                            <button
                                onClick={() => setTimeRange('7days')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${timeRange === '7days' ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                7 Days
                            </button>
                            <button
                                onClick={() => setTimeRange('30days')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${timeRange === '30days' ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                30 Days
                            </button>
                            <button
                                onClick={() => setTimeRange('all')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${timeRange === 'all' ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                All Time
                            </button>
                        </div>
                    </div>
                </div>

                {transactions.length === 0 ? (
                    <div className="text-center py-12 bg-card/80 backdrop-blur-sm border-2 border-border rounded-2xl">
                        <svg className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <p className="text-muted-foreground mb-4">No transaction data available</p>
                        <Link href="/transactions" className="inline-block px-6 py-3 bg-primary text-white rounded-xl hover:opacity-90 transition-opacity font-medium">
                            Add your first transaction
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* Conversational Intelligence Hub */}
                        <div className="mb-8">
                            <div className="group bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-2 border-primary/20 rounded-2xl p-6 mb-6 hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                        <span className="text-xl">💬</span>
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="text-lg font-bold text-foreground mb-2">
                                            Your Financial Story This {timeRange === '7days' ? 'Week' : timeRange === '30days' ? 'Month' : 'Period'}
                                        </h2>
                                        <p className="text-foreground/90 leading-relaxed mb-4">
                                            {insights.netSavings >= 0 
                                                ? `Great work! You've saved $${insights.netSavings.toFixed(2)} this period. That's a ${insights.savingsRate.toFixed(0)}% savings rate. `
                                                : `You spent $${Math.abs(insights.netSavings).toFixed(2)} more than you earned this period. `
                                            }
                                            {insights.topCategory && `Your biggest expense was ${insights.topCategory.name} at $${insights.topCategory.value.toFixed(2)}. `}
                                            {insights.trendDirection === 'increasing' && `Your spending is trending up ${Math.abs(insights.trendPercentage).toFixed(0)}% compared to last week. `}
                                            {insights.trendDirection === 'decreasing' && `Great news! Your spending dropped ${Math.abs(insights.trendPercentage).toFixed(0)}% compared to last week. `}
                                            {insights.overBudgetCategories.length > 0 
                                                ? `Watch out - ${insights.overBudgetCategories.length} ${insights.overBudgetCategories.length === 1 ? 'category is' : 'categories are'} over budget.`
                                                : 'All your budgets are on track! 🎉'
                                            }
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                                                {insights.overBudgetCategories.length} warnings
                                            </span>
                                            <span className="text-xs font-medium text-success bg-success/10 px-2 py-1 rounded">
                                                {budgetVsActual.filter(cat => cat.Actual <= cat.Budget).length} on track
                                            </span>
                                            {insights.trendDirection !== 'stable' && (
                                                <span className={`text-xs font-medium px-2 py-1 rounded ${
                                                    insights.trendDirection === 'decreasing' 
                                                        ? 'text-success bg-success/10' 
                                                        : 'text-warning bg-warning/10'
                                                }`}>
                                                    {insights.trendDirection === 'decreasing' ? '↓' : '↑'} Trending {insights.trendDirection}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div 
                                    onClick={() => setExpandedInsight(expandedInsight === 1 ? null : 1)}
                                    className="group bg-card/80 backdrop-blur-sm border-2 border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer"
                                >
                                    <div className="flex items-start gap-3 mb-3">
                                        <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                            <span className="text-lg">💡</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-semibold text-foreground mb-1">
                                                {insights.savingsRate > 20 ? 'Excellent Savings!' : insights.savingsRate > 10 ? 'Good Progress' : 'Opportunity to Save'}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                {insights.savingsRate > 20 
                                                    ? `${insights.savingsRate.toFixed(0)}% savings rate - you're crushing it!`
                                                    : insights.savingsRate > 10
                                                    ? `${insights.savingsRate.toFixed(0)}% saved. Aim for 20%+ for faster goals.`
                                                    : insights.savingsRate > 0
                                                    ? `${insights.savingsRate.toFixed(0)}% saved. Small wins add up!`
                                                    : 'Spending exceeded income this period.'
                                                }
                                            </p>
                                        </div>
                                        <svg className={`w-4 h-4 text-muted-foreground transition-transform ${expandedInsight === 1 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                    
                                    {expandedInsight === 1 && (
                                        <div className="mt-4 pt-4 border-t border-border space-y-3 animate-slide-up">
                                            <div className="bg-muted/30 rounded-xl p-3">
                                                <p className="text-xs text-muted-foreground mb-2">
                                                    <strong>Quick Calculation:</strong>
                                                </p>
                                                <p className="text-xs text-foreground">
                                                    Income: ${insights.totalIncome.toFixed(2)}<br/>
                                                    Expenses: ${insights.totalExpenses.toFixed(2)}<br/>
                                                    Saved: ${insights.netSavings.toFixed(2)} ({insights.savingsRate.toFixed(1)}%)
                                                </p>
                                            </div>
                                            {insights.savingsRate < 20 && (
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toast.success('Tip: Review your top expense category to find savings!');
                                                    }}
                                                    className="w-full py-2 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                                                >
                                                    💡 Show me how to save more
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div 
                                    onClick={() => setExpandedInsight(expandedInsight === 2 ? null : 2)}
                                    className="group bg-card/80 backdrop-blur-sm border-2 border-border rounded-2xl p-5 hover:border-warning/40 hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer"
                                >
                                    <div className="flex items-start gap-3 mb-3">
                                        <div className="w-8 h-8 bg-warning/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                            <span className="text-lg">⚠️</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-semibold text-foreground mb-1">
                                                {insights.overBudgetCategories.length > 0 
                                                    ? 'Budget Alert' 
                                                    : insights.highestSpendingDay 
                                                    ? 'Spending Pattern'
                                                    : 'Watch Out'
                                                }
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                {insights.overBudgetCategories.length > 0
                                                    ? `${insights.overBudgetCategories[0].category} over by $${(insights.overBudgetCategories[0].Actual - insights.overBudgetCategories[0].Budget).toFixed(2)}`
                                                    : totalSubscriptionCost > 0
                                                    ? `${subscriptions.length} subscriptions = $${totalSubscriptionCost.toFixed(2)}/month`
                                                    : `Most spending on ${insights.highestSpendingDay}s`
                                                }
                                            </p>
                                        </div>
                                        <svg className={`w-4 h-4 text-muted-foreground transition-transform ${expandedInsight === 2 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                    
                                    {expandedInsight === 2 && (
                                        <div className="mt-4 pt-4 border-t border-border space-y-3 animate-slide-up">
                                            {insights.overBudgetCategories.length > 0 ? (
                                                <>
                                                    <div className="bg-danger/10 rounded-xl p-3">
                                                        <p className="text-xs font-semibold text-danger mb-2">
                                                            Over Budget Categories:
                                                        </p>
                                                        {insights.overBudgetCategories.slice(0, 3).map((cat, i) => (
                                                            <p key={i} className="text-xs text-foreground">
                                                                • {cat.category}: +${(cat.Actual - cat.Budget).toFixed(2)}
                                                            </p>
                                                        ))}
                                                    </div>
                                                    <Link
                                                        href="/categories"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="block w-full py-2 text-xs font-semibold text-center text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                                                    >
                                                        Adjust budgets →
                                                    </Link>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="bg-muted/30 rounded-xl p-3">
                                                        <p className="text-xs text-foreground">
                                                            💡 <strong>Pattern detected:</strong> You spend most on {insights.highestSpendingDay}s. 
                                                            Planning ahead might help reduce impulse purchases.
                                                        </p>
                                                    </div>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toast.success('Great idea! Try setting a specific budget for weekends.');
                                                        }}
                                                        className="w-full py-2 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                                                    >
                                                        Set weekly budget reminder
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div 
                                    onClick={() => setExpandedInsight(expandedInsight === 3 ? null : 3)}
                                    className="group bg-card/80 backdrop-blur-sm border-2 border-border rounded-2xl p-5 hover:border-success/40 hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer"
                                >
                                    <div className="flex items-start gap-3 mb-3">
                                        <div className="w-8 h-8 bg-success/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                            <span className="text-lg">
                                                {insights.trendDirection === 'decreasing' ? '🎯' : insights.netSavings > 0 ? '✨' : '📊'}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-semibold text-foreground mb-1">
                                                {insights.trendDirection === 'decreasing' 
                                                    ? 'Spending Decreased!' 
                                                    : insights.trendDirection === 'increasing'
                                                    ? 'Spending Increased'
                                                    : 'Financial Health'
                                                }
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                {insights.trendDirection === 'decreasing'
                                                    ? `Down ${Math.abs(insights.trendPercentage).toFixed(0)}% from last week. Keep it up!`
                                                    : insights.trendDirection === 'increasing'
                                                    ? `Up ${Math.abs(insights.trendPercentage).toFixed(0)}% from last week. Stay mindful.`
                                                    : budgetVsActual.length > 0
                                                    ? `${budgetVsActual.filter(cat => cat.Actual <= cat.Budget).length}/${budgetVsActual.length} budgets healthy`
                                                    : `${getFilteredTransactions().length} transactions tracked`
                                                }
                                            </p>
                                        </div>
                                        <svg className={`w-4 h-4 text-muted-foreground transition-transform ${expandedInsight === 3 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                    
                                    {expandedInsight === 3 && (
                                        <div className="mt-4 pt-4 border-t border-border space-y-3 animate-slide-up">
                                            {insights.largestExpense && (
                                                <div className="bg-muted/30 rounded-xl p-3">
                                                    <p className="text-xs font-semibold text-foreground mb-2">
                                                        Largest Expense:
                                                    </p>
                                                    <p className="text-sm text-foreground">
                                                        ${parseFloat(insights.largestExpense.amount).toFixed(2)} - {insights.largestExpense.category_name || 'Uncategorized'}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {insights.largestExpense.note || 'No note'}
                                                    </p>
                                                </div>
                                            )}
                                            <Link
                                                href="/transactions"
                                                onClick={(e) => e.stopPropagation()}
                                                className="block w-full py-2 text-xs font-semibold text-center text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                                            >
                                                View all transactions →
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Subscriptions Alert */}
                        {subscriptions.length > 0 && (
                            <div className="bg-gradient-to-br from-accent/10 to-accent/5 border-2 border-accent/20 rounded-2xl p-6 mb-8 hover:shadow-xl transition-all hover:-translate-y-1">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-foreground mb-1">Recurring Expenses Detected</h2>
                                        <p className="text-sm text-muted-foreground">Monitor your subscriptions and recurring costs</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-muted-foreground">Total Monthly</p>
                                        <p className="text-2xl font-bold text-primary">${totalSubscriptionCost.toFixed(2)}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {subscriptions.map((sub, index) => (
                                        <div key={index} className="group bg-card/50 backdrop-blur border-2 border-border rounded-xl p-4 hover:border-accent/40 hover:shadow-lg transition-all hover:-translate-y-1">
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex-1">
                                                    <h3 className="font-semibold text-foreground mb-1 truncate">{sub.name}</h3>
                                                    <p className="text-xs text-muted-foreground">{sub.category}</p>
                                                </div>
                                                <div className={`px-2 py-1 rounded text-xs font-medium ${sub.amount > 50 ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                                                    {sub.amount > 50 ? 'High' : 'Low'}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-2xl font-bold text-foreground">${sub.amount.toFixed(2)}</span>
                                                <span className="text-xs text-muted-foreground">{sub.frequency}x charged</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-2">
                                                Last: {new Date(sub.lastCharge).toLocaleDateString()}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 p-4 bg-warning/10 border-2 border-warning/20 rounded-xl">
                                    <div className="flex items-start space-x-2">
                                        <svg className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-warning">
                                                Subscriptions account for ${totalSubscriptionCost.toFixed(2)}/month
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Review regularly to avoid unused subscriptions draining your budget
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Spending Trend Chart */}
                        <div ref={spendingTrendRef} className="bg-card/80 backdrop-blur-sm border-2 border-border rounded-2xl p-6 mb-8 hover:border-primary/40 hover:shadow-xl transition-all">
                            <div className="mb-4 flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-bold text-foreground mb-2">Spending Trend</h2>
                                    <p className="text-sm text-muted-foreground">
                                        💬 Your spending has been {insights.netSavings >= 0 ? 'under control' : 'higher than income'} this period. 
                                        {insights.netSavings >= 0 ? ' Keep up the great work!' : ' Consider reviewing your largest expenses.'}
                                    </p>
                                </div>
                                <DownloadButton chartRef={spendingTrendRef} filename="spending-trend" />
                            </div>
                            <ResponsiveContainer width="100%" height={350}>
                                <LineChart data={spendingTrend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} opacity={0.3} />
                                    <XAxis dataKey="date" stroke={theme === 'dark' ? '#6B7280' : '#9CA3AF'} style={{ fontSize: '12px' }} tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280' }} tickLine={false} />
                                    <YAxis stroke={theme === 'dark' ? '#6B7280' : '#9CA3AF'} style={{ fontSize: '12px' }} tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280' }} tickLine={false} tickFormatter={(value) => `$${value}`} />
                                    <Tooltip content={<CustomLineTooltip />} cursor={false} />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="line" />
                                    <Line type="monotone" dataKey="Expenses" stroke="#EF4444" strokeWidth={2.5} dot={false} activeDot={false} />
                                    <Line type="monotone" dataKey="Income" stroke="#10B981" strokeWidth={2.5} dot={false} activeDot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Charts Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                            {/* Expense Distribution */}
                            <div ref={expenseDistRef} className="bg-card/80 backdrop-blur-sm border-2 border-border rounded-2xl p-6 hover:border-primary/40 hover:shadow-xl transition-all">
                                <div className="mb-4 flex items-start justify-between gap-4">
                                    <div>
                                        <h2 className="text-xl font-bold text-foreground mb-2">Expense Distribution</h2>
                                        <p className="text-sm text-muted-foreground">
                                            💬 {insights.topCategory 
                                                ? `${insights.topCategory.name} is your biggest expense (${((insights.topCategory.value / insights.totalExpenses) * 100).toFixed(0)}%). ${insights.topCategory.value > insights.totalExpenses * 0.3 ? 'Consider if this aligns with your priorities.' : 'This seems balanced.'}`
                                                : 'Start tracking expenses to see your breakdown.'
                                            }
                                        </p>
                                    </div>
                                    <DownloadButton chartRef={expenseDistRef} filename="expense-distribution" />
                                </div>
                                {categoryBreakdown.length > 0 ? (
                                    <>
                                        <ResponsiveContainer width="100%" height={280}>
                                            <PieChart>
                                                <Pie
                                                    data={categoryBreakdown}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={70}
                                                    outerRadius={110}
                                                    fill="#8884d8"
                                                    dataKey="value"
                                                    paddingAngle={2}
                                                    label={(entry) => {
                                                        const total = categoryBreakdown.reduce((sum, cat) => sum + cat.value, 0);
                                                        const percentage = (entry.value / total) * 100;
                                                        if (percentage < 5) return null;
                                                        return `${percentage.toFixed(0)}%`;
                                                    }}
                                                    labelLine={false}
                                                >
                                                    {categoryBreakdown.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
                                                        border: `2px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}`,
                                                        borderRadius: '12px',
                                                        padding: '8px 12px',
                                                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                                                        color: theme === 'dark' ? '#F3F4F6' : '#1F2937'
                                                    }}
                                                    formatter={(value: any) => `$${value.toFixed(2)}`}
                                                    itemStyle={{ color: theme === 'dark' ? '#F3F4F6' : '#1F2937', fontSize: '12px' }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>

                                        <div className="mt-4 space-y-2">
                                            {categoryBreakdown.map((item, index) => {
                                                const total = categoryBreakdown.reduce((sum, cat) => sum + cat.value, 0);
                                                const percentage = (item.value / total) * 100;

                                                return (
                                                    <div key={index} className="flex items-center justify-between py-1">
                                                        <div className="flex items-center space-x-2">
                                                            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                                            <span className="text-sm text-foreground">{item.name}</span>
                                                        </div>
                                                        <div className="text-sm">
                                                            <span className="font-semibold text-foreground">${item.value.toFixed(2)}</span>
                                                            <span className="text-muted-foreground ml-2">({percentage.toFixed(1)}%)</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                                        <p>No expense data</p>
                                    </div>
                                )}
                            </div>

                            {/* Budget vs Actual */}
                            <div ref={budgetVsActualRef} className="bg-card/80 backdrop-blur-sm border-2 border-border rounded-2xl p-6 hover:border-primary/40 hover:shadow-xl transition-all">
                                <div className="mb-4 flex items-start justify-between gap-4">
                                    <div>
                                        <h2 className="text-xl font-bold text-foreground mb-2">Budget vs Actual</h2>
                                        <p className="text-sm text-muted-foreground">
                                            💬 {insights.overBudgetCategories.length > 0
                                                ? `You're over budget in ${insights.overBudgetCategories.length} ${insights.overBudgetCategories.length === 1 ? 'category' : 'categories'}. Time to adjust spending or budgets.`
                                                : budgetVsActual.length > 0
                                                ? 'All budgets are looking healthy! Great financial discipline. 🎉'
                                                : 'Set budget limits to track your spending goals.'
                                            }
                                        </p>
                                    </div>
                                    <DownloadButton chartRef={budgetVsActualRef} filename="budget-vs-actual" />
                                </div>
                                {budgetVsActual.length > 0 ? (
                                    <>
                                        <ResponsiveContainer width="100%" height={280}>
                                            <BarChart data={budgetVsActual} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} opacity={0.3} />
                                                <XAxis dataKey="category" stroke={theme === 'dark' ? '#6B7280' : '#9CA3AF'} style={{ fontSize: '11px' }} tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280' }} tickLine={false} angle={-45} textAnchor="end" height={60} />
                                                <YAxis stroke={theme === 'dark' ? '#6B7280' : '#9CA3AF'} style={{ fontSize: '12px' }} tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280' }} tickLine={false} tickFormatter={(value) => `$${value}`} />
                                                <Tooltip content={<CustomBudgetTooltip />} cursor={false} />
                                                <Legend wrapperStyle={{ paddingTop: '10px' }} iconType="rect" />
                                                <Bar dataKey="Budget" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={35} />
                                                <Bar dataKey="Actual" radius={[4, 4, 0, 0]} maxBarSize={35}>
                                                    {budgetVsActual.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.Actual > entry.Budget ? '#EF4444' : '#10B981'} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>

                                        <div className="mt-4 space-y-2">
                                            {budgetVsActual.map((item, index) => {
                                                const difference = item.Actual - item.Budget;
                                                const isOver = difference > 0;
                                                const percentage = item.Budget > 0 ? Math.abs((difference / item.Budget) * 100) : 0;

                                                return (
                                                    <div key={index} className="flex items-center justify-between text-xs py-1">
                                                        <span className="text-muted-foreground">{item.category}</span>
                                                        <span className={`font-medium ${isOver ? 'text-danger' : 'text-success'}`}>
                                                            {isOver ? '+' : '-'}${Math.abs(difference).toFixed(2)} ({isOver ? '+' : '-'}{percentage.toFixed(0)}%)
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-[340px] flex items-center justify-center text-muted-foreground">
                                        <div className="text-center">
                                            <svg className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                            <p className="text-sm mb-2">No budget limits set</p>
                                            <Link href="/categories" className="text-xs text-primary hover:underline">
                                                Add budget limits to categories
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Income vs Expenses */}
                        <div ref={incomeExpenseRef} className="bg-card/80 backdrop-blur-sm border-2 border-border rounded-2xl p-6 mb-8 hover:border-primary/40 hover:shadow-xl transition-all">
                            <div className="mb-4 flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-bold text-foreground mb-2">Income vs Expenses</h2>
                                    <p className="text-sm text-muted-foreground">
                                        💬 You're saving {insights.savingsRate.toFixed(0)}% of your income this period. 
                                        {insights.savingsRate >= 20 
                                            ? ' Excellent work - you\'re on track for financial freedom! 🎯'
                                            : insights.savingsRate >= 10
                                            ? ' Good progress! Aim for 20%+ for faster wealth building.'
                                            : insights.savingsRate > 0
                                            ? ' Every bit counts! Try to gradually increase this percentage.'
                                            : ' Consider ways to reduce expenses or increase income.'
                                        }
                                    </p>
                                </div>
                                <DownloadButton chartRef={incomeExpenseRef} filename="income-vs-expenses" />
                            </div>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={incomeExpenseData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} opacity={0.3} />
                                    <XAxis dataKey="name" stroke={theme === 'dark' ? '#6B7280' : '#9CA3AF'} style={{ fontSize: '14px' }} tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280' }} tickLine={false} />
                                    <YAxis stroke={theme === 'dark' ? '#6B7280' : '#9CA3AF'} style={{ fontSize: '12px' }} tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280' }} tickLine={false} tickFormatter={(value) => `$${value}`} />
                                    <Tooltip content={<CustomIncomeExpenseTooltip />} cursor={false} />
                                    <Bar dataKey="amount" radius={[8, 8, 0, 0]} maxBarSize={150}>
                                        {incomeExpenseData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.name === 'Income' ? '#10B981' : '#EF4444'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>

                            <div className="mt-6 grid grid-cols-3 gap-4">
                                <div className="group bg-success/10 border-2 border-success/20 rounded-xl p-4 text-center hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer">
                                    <p className="text-xs text-muted-foreground mb-1">Total Income</p>
                                    <p className="text-xl font-bold text-success">
                                        ${incomeExpenseData.find(d => d.name === 'Income')?.amount.toFixed(2) || '0.00'}
                                    </p>
                                </div>
                                <div className="group bg-danger/10 border-2 border-danger/20 rounded-xl p-4 text-center hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer">
                                    <p className="text-xs text-muted-foreground mb-1">Total Expenses</p>
                                    <p className="text-xl font-bold text-danger">
                                        ${incomeExpenseData.find(d => d.name === 'Expenses')?.amount.toFixed(2) || '0.00'}
                                    </p>
                                </div>
                                <div className="group bg-primary/10 border-2 border-primary/20 rounded-xl p-4 text-center hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer">
                                    <p className="text-xs text-muted-foreground mb-1">Net Savings</p>
                                    <p className="text-xl font-bold text-primary">
                                        ${((incomeExpenseData.find(d => d.name === 'Income')?.amount || 0) - (incomeExpenseData.find(d => d.name === 'Expenses')?.amount || 0)).toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}