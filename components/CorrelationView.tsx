'use client'

import { useState, useEffect } from 'react'
import { Search, TrendingUp } from 'lucide-react'
import axios from 'axios'
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { format } from 'date-fns'

interface CorrelationData {
  date: string
  stockPrice: number
  newsCount: number
  positiveSentiment: number
  negativeSentiment: number
  neutralSentiment: number
}

export default function CorrelationView() {
  const [symbol, setSymbol] = useState('AAPL')
  const [keywords, setKeywords] = useState('')
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [correlationData, setCorrelationData] = useState<CorrelationData[]>([])

  const fetchCorrelationData = async () => {
    if (!symbol) {
      alert('Please enter a stock symbol')
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({ symbol, dateFrom, dateTo })
      if (keywords) params.append('keywords', keywords)

      const response = await axios.get(`/api/correlation?${params.toString()}`)
      const data = response.data.map((item: any) => ({
        ...item,
        date: format(new Date(item.date), 'MMM dd'),
      }))
      setCorrelationData(data)
    } catch (error) {
      console.error('Error fetching correlation data:', error)
      alert('Failed to fetch correlation data. Make sure you have both news and stock data for this period.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (symbol) {
      fetchCorrelationData()
    }
  }, [])

  const calculateCorrelation = () => {
    if (correlationData.length < 2) return null

    const validData = correlationData.filter((d) => d.stockPrice > 0 && d.newsCount > 0)
    if (validData.length < 2) return null

    const n = validData.length
    const sumX = validData.reduce((sum, d) => sum + d.newsCount, 0)
    const sumY = validData.reduce((sum, d) => sum + d.stockPrice, 0)
    const sumXY = validData.reduce((sum, d) => sum + d.newsCount * d.stockPrice, 0)
    const sumX2 = validData.reduce((sum, d) => sum + d.newsCount * d.newsCount, 0)
    const sumY2 = validData.reduce((sum, d) => sum + d.stockPrice * d.stockPrice, 0)

    const numerator = n * sumXY - sumX * sumY
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))

    if (denominator === 0) return null
    return numerator / denominator
  }

  const calculateSentimentCorrelation = () => {
    if (correlationData.length < 2) return null

    const validData = correlationData.filter((d) => d.stockPrice > 0)
    if (validData.length < 2) return null

    const sentimentScores = validData.map((d) => {
      const total = d.positiveSentiment + d.negativeSentiment + d.neutralSentiment
      if (total === 0) return 0
      return (d.positiveSentiment - d.negativeSentiment) / total
    })

    const prices = validData.map((d) => d.stockPrice)

    const n = validData.length
    const sumX = sentimentScores.reduce((sum, s) => sum + s, 0)
    const sumY = prices.reduce((sum, p) => sum + p, 0)
    const sumXY = sentimentScores.reduce((sum, s, i) => sum + s * prices[i], 0)
    const sumX2 = sentimentScores.reduce((sum, s) => sum + s * s, 0)
    const sumY2 = prices.reduce((sum, p) => sum + p * p, 0)

    const numerator = n * sumXY - sumX * sumY
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))

    if (denominator === 0) return null
    return numerator / denominator
  }

  const newsCorrelation = calculateCorrelation()
  const sentimentCorrelation = calculateSentimentCorrelation()

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Correlation Analysis Settings
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Stock Symbol
            </label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="AAPL"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Keywords (optional)
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="Apple, iPhone"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
        <button
          onClick={fetchCorrelationData}
          disabled={loading}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          <Search className="w-4 h-4" />
          {loading ? 'Loading...' : 'Analyze Correlation'}
        </button>
      </div>

      {/* Correlation Statistics */}
      {correlationData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">News Volume Correlation</div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {newsCorrelation !== null ? newsCorrelation.toFixed(3) : 'N/A'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {newsCorrelation !== null &&
                    (Math.abs(newsCorrelation) > 0.7
                      ? 'Strong correlation'
                      : Math.abs(newsCorrelation) > 0.4
                      ? 'Moderate correlation'
                      : 'Weak correlation')}
                </div>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Sentiment Correlation</div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {sentimentCorrelation !== null ? sentimentCorrelation.toFixed(3) : 'N/A'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {sentimentCorrelation !== null &&
                    (Math.abs(sentimentCorrelation) > 0.7
                      ? 'Strong correlation'
                      : Math.abs(sentimentCorrelation) > 0.4
                      ? 'Moderate correlation'
                      : 'Weak correlation')}
                </div>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total News Articles</div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {correlationData.reduce((sum, d) => sum + d.newsCount, 0)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Across {correlationData.filter((d) => d.newsCount > 0).length} days
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Correlation Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Stock Price vs News Volume
        </h3>
        {loading ? (
          <div className="h-96 flex items-center justify-center">
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        ) : correlationData.length === 0 ? (
          <div className="h-96 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No data available for this period.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Make sure you have fetched both news and stock data for the selected date range.
              </p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={correlationData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar
                yAxisId="right"
                dataKey="newsCount"
                fill="#3b82f6"
                name="News Articles"
                opacity={0.6}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="stockPrice"
                stroke="#ef4444"
                strokeWidth={2}
                name="Stock Price ($)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Sentiment Breakdown Chart */}
      {correlationData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Stock Price vs News Sentiment
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={correlationData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar
                yAxisId="right"
                dataKey="positiveSentiment"
                stackId="sentiment"
                fill="#10b981"
                name="Positive News"
              />
              <Bar
                yAxisId="right"
                dataKey="neutralSentiment"
                stackId="sentiment"
                fill="#6b7280"
                name="Neutral News"
              />
              <Bar
                yAxisId="right"
                dataKey="negativeSentiment"
                stackId="sentiment"
                fill="#ef4444"
                name="Negative News"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="stockPrice"
                stroke="#8b5cf6"
                strokeWidth={2}
                name="Stock Price ($)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Insights */}
      {correlationData.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-bold text-blue-900 dark:text-blue-300 mb-3">
            Analysis Insights
          </h3>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li>
              • <strong>News Volume Correlation:</strong> {newsCorrelation !== null ? (
                <>
                  A correlation of {newsCorrelation.toFixed(3)} suggests that news volume and stock price have a{' '}
                  {Math.abs(newsCorrelation) > 0.7
                    ? 'strong'
                    : Math.abs(newsCorrelation) > 0.4
                    ? 'moderate'
                    : 'weak'}{' '}
                  {newsCorrelation > 0 ? 'positive' : 'negative'} relationship.
                </>
              ) : (
                'Not enough data to calculate correlation.'
              )}
            </li>
            <li>
              • <strong>Sentiment Correlation:</strong> {sentimentCorrelation !== null ? (
                <>
                  A correlation of {sentimentCorrelation.toFixed(3)} indicates that news sentiment has a{' '}
                  {Math.abs(sentimentCorrelation) > 0.7
                    ? 'strong'
                    : Math.abs(sentimentCorrelation) > 0.4
                    ? 'moderate'
                    : 'weak'}{' '}
                  {sentimentCorrelation > 0 ? 'positive' : 'negative'} correlation with stock price movements.
                </>
              ) : (
                'Not enough data to calculate correlation.'
              )}
            </li>
            <li>
              • <strong>Pattern Detection:</strong> Look for spikes in news volume or sentiment changes that
              precede or coincide with significant stock price movements.
            </li>
            <li>
              • <strong>Note:</strong> Correlation does not imply causation. These patterns should be used as
              one of many factors in investment analysis.
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
