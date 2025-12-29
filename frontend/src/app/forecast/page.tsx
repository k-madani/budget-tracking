'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Forecast {
  category: string;
  predicted_amount: number;
  confidence_score: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  historical_average: number;
}

interface Warning {
  category: string;
  budget_limit: number;
  predicted_amount: number;
  overage_percentage: number;
  trend: string;
  confidence: number;
}

interface ForecastSummary {
  forecast_month: string;
  total_predicted_spending: number;
  total_historical_average: number;
  change_percentage: number;
  warning_count: number;
}

export default function ForecastPage() {
  const [summary, setSummary] = useState<ForecastSummary | null>(null);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchForecastData();
  }, []);

  const fetchForecastData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch('http://localhost:8000/api/budgets/forecasts/summary/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSummary(data.summary);
        setForecasts(data.forecasts);
        setWarnings(data.warnings);
      }
    } catch (error) {
      console.error('Error fetching forecast:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <span className="text-red-400">↗ Increasing</span>;
      case 'decreasing':
        return <span className="text-green-400">↘ Decreasing</span>;
      default:
        return <span className="text-gray-400">→ Stable</span>;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return 'text-green-400';
    if (confidence >= 0.4) return 'text-yellow-400';
    return 'text-red-400';
  };

  const chartData = {
    labels: forecasts.map(f => f.category),
    datasets: [
      {
        label: 'Predicted Spending',
        data: forecasts.map(f => f.predicted_amount),
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        borderColor: 'rgb(99, 102, 241)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      },
      {
        label: 'Historical Average',
        data: forecasts.map(f => f.historical_average),
        backgroundColor: 'rgba(156, 163, 175, 0.1)',
        borderColor: 'rgb(156, 163, 175)',
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        tension: 0.4
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#D1D5DB',
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#9CA3AF',
          callback: function(value: any) {
            return '$' + value;
          }
        },
        grid: {
          color: 'rgba(156, 163, 175, 0.1)'
        }
      },
      x: {
        ticks: {
          color: '#9CA3AF'
        },
        grid: {
          color: 'rgba(156, 163, 175, 0.1)'
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading forecast...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <Navbar currentPage="forecast" />
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">💡 Spending Forecast</h1>
          <p className="text-gray-400">AI-powered predictions of your upcoming expenses</p>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="backdrop-blur-md bg-white/10 rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all">
              <div className="text-gray-400 text-sm mb-2">Forecast Period</div>
              <div className="text-2xl font-bold">{summary.forecast_month}</div>
              <div className="text-xs text-gray-500 mt-1">Next month</div>
            </div>

            <div className="backdrop-blur-md bg-white/10 rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all">
              <div className="text-gray-400 text-sm mb-2">Predicted Spending</div>
              <div className="text-2xl font-bold font-mono tabular-nums">${summary.total_predicted_spending.toFixed(2)}</div>
              <div className={`text-sm mt-1 ${summary.change_percentage > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {summary.change_percentage > 0 ? '↑' : '↓'} {Math.abs(summary.change_percentage)}% vs avg
              </div>
            </div>

            <div className="backdrop-blur-md bg-white/10 rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all">
              <div className="text-gray-400 text-sm mb-2">Historical Average</div>
              <div className="text-2xl font-bold font-mono tabular-nums">${summary.total_historical_average.toFixed(2)}</div>
              <div className="text-xs text-gray-500 mt-1">Last 6 months</div>
            </div>

            <div className="backdrop-blur-md bg-white/10 rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all">
              <div className="text-gray-400 text-sm mb-2">Budget Alerts</div>
              <div className="text-2xl font-bold">{summary.warning_count}</div>
              <div className="text-xs text-gray-500 mt-1">
                {summary.warning_count === 0 ? 'All on track!' : 'categories at risk'}
              </div>
            </div>
          </div>
        )}

        {/* No Data Message */}
        {forecasts.length === 0 && (
          <div className="backdrop-blur-md bg-white/10 rounded-xl p-12 border border-white/20 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-2xl font-bold mb-2">Not Enough Data Yet</h2>
            <p className="text-gray-400 mb-4">
              We need at least 3 transactions per category over the last 6 months to generate accurate forecasts.
            </p>
            <p className="text-gray-500 text-sm">
              Keep tracking your expenses and check back soon!
            </p>
          </div>
        )}

        {/* Budget Warnings */}
        {warnings.length > 0 && (
          <div className="mb-8 backdrop-blur-md bg-red-500/10 rounded-xl p-6 border border-red-500/30">
            <h2 className="text-xl font-bold mb-4 text-red-400">⚠️ Budget Warnings</h2>
            <div className="space-y-3">
              {warnings.map((warning, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                  <div>
                    <div className="font-semibold text-lg">{warning.category}</div>
                    <div className="text-sm text-gray-400 mt-1">
                      Budget: ${warning.budget_limit.toFixed(2)} → Predicted: ${warning.predicted_amount.toFixed(2)}
                    </div>
                    <div className="text-xs mt-1">{getTrendIcon(warning.trend)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-red-400 font-bold text-2xl">+{warning.overage_percentage}%</div>
                    <div className="text-xs text-gray-400">over budget</div>
                    <div className={`text-xs mt-1 ${getConfidenceColor(warning.confidence)}`}>
                      {(warning.confidence * 100).toFixed(0)}% confidence
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chart */}
        {forecasts.length > 0 && (
          <div className="mb-8 backdrop-blur-md bg-white/10 rounded-xl p-6 border border-white/20">
            <h2 className="text-xl font-bold mb-4">📈 Forecast vs Historical Average</h2>
            <div className="h-80">
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>
        )}

        {/* Detailed Forecasts Table */}
        {forecasts.length > 0 && (
          <div className="backdrop-blur-md bg-white/10 rounded-xl p-6 border border-white/20">
            <h2 className="text-xl font-bold mb-4">📋 Category Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Category</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-semibold">Historical</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-semibold">Predicted</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-semibold">Change</th>
                    <th className="text-center py-3 px-4 text-gray-400 font-semibold">Trend</th>
                    <th className="text-center py-3 px-4 text-gray-400 font-semibold">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {forecasts.map((forecast, index) => {
                    const change = ((forecast.predicted_amount - forecast.historical_average) / forecast.historical_average * 100);
                    return (
                      <tr key={index} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                        <td className="py-4 px-4 font-semibold">{forecast.category}</td>
                        <td className="py-4 px-4 text-right font-mono tabular-nums text-gray-400">
                          ${forecast.historical_average.toFixed(2)}
                        </td>
                        <td className="py-4 px-4 text-right font-mono tabular-nums font-bold text-lg">
                          ${forecast.predicted_amount.toFixed(2)}
                        </td>
                        <td className={`py-4 px-4 text-right font-mono tabular-nums ${change > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {change > 0 ? '+' : ''}{change.toFixed(1)}%
                        </td>
                        <td className="py-4 px-4 text-center">{getTrendIcon(forecast.trend)}</td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className={`font-semibold text-lg ${getConfidenceColor(forecast.confidence_score)}`}>
                              {(forecast.confidence_score * 100).toFixed(0)}%
                            </span>
                            <div className="w-full bg-gray-700 rounded-full h-2 mt-1 max-w-[80px]">
                              <div 
                                className={`h-2 rounded-full ${
                                  forecast.confidence_score >= 0.7 ? 'bg-green-400' :
                                  forecast.confidence_score >= 0.4 ? 'bg-yellow-400' : 'bg-red-400'
                                }`}
                                style={{ width: `${forecast.confidence_score * 100}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-8 text-center text-gray-400 text-sm space-y-2">
          <p>🤖 Forecasts use machine learning to analyze your spending patterns from the last 6 months</p>
          <p>📊 Higher confidence scores indicate more consistent and predictable spending behavior</p>
          <p>🔄 Predictions automatically factor in your recurring transaction templates</p>
        </div>
      </div>

    </div>
  );
}