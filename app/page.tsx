'use client'

import { useState } from 'react'
import NewsDashboard from '@/components/NewsDashboard'
import StockMarketDashboard from '@/components/StockMarketDashboard'
import CorrelationView from '@/components/CorrelationView'

type ViewMode = 'news' | 'stocks' | 'correlation'

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>('news')

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            News & Market Intelligence Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track news sentiment and correlate with stock market movements
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-2 mb-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setViewMode('news')}
            className={`px-6 py-3 font-medium transition-colors ${
              viewMode === 'news'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            News Dashboard
          </button>
          <button
            onClick={() => setViewMode('stocks')}
            className={`px-6 py-3 font-medium transition-colors ${
              viewMode === 'stocks'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Stock Market
          </button>
          <button
            onClick={() => setViewMode('correlation')}
            className={`px-6 py-3 font-medium transition-colors ${
              viewMode === 'correlation'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Correlation Analysis
          </button>
        </div>

        {/* Content */}
        <div>
          {viewMode === 'news' && <NewsDashboard />}
          {viewMode === 'stocks' && <StockMarketDashboard />}
          {viewMode === 'correlation' && <CorrelationView />}
        </div>
      </div>
    </main>
  )
}
