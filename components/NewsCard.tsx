'use client'

import { ExternalLink, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { format } from 'date-fns'

interface NewsCardProps {
  article: {
    id: string
    title: string
    description: string | null
    url: string
    imageUrl: string | null
    source: string
    category: string[]
    keywords: string[]
    sentiment: string | null
    publishedAt: string
    entities: Array<{ name: string; type: string }>
  }
}

export default function NewsCard({ article }: NewsCardProps) {
  const getSentimentIcon = (sentiment: string | null) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp className="w-5 h-5" />
      case 'negative':
        return <TrendingDown className="w-5 h-5" />
      default:
        return <Minus className="w-5 h-5" />
    }
  }

  const getSentimentColor = (sentiment: string | null) => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-600 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800'
      case 'negative':
        return 'text-red-600 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'
      default:
        return 'text-gray-600 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 transition-all p-4">
      <div className="flex items-start gap-4">
        {/* Sentiment Indicator */}
        <div className={`flex-shrink-0 w-16 h-16 rounded-lg border-2 ${getSentimentColor(article.sentiment)} flex items-center justify-center`}>
          {getSentimentIcon(article.sentiment)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
              {article.source}
            </span>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Calendar className="w-3 h-3" />
              {format(new Date(article.publishedAt), 'MMM dd, HH:mm')}
            </div>
          </div>

          {/* Headline */}
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 leading-tight hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            <a href={article.url} target="_blank" rel="noopener noreferrer">
              {article.title}
            </a>
          </h3>

          {/* Sentiment Badge */}
          {article.sentiment && (
            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold mb-3 border-2"
              style={{
                borderColor: article.sentiment === 'positive' ? '#10b981' : article.sentiment === 'negative' ? '#ef4444' : '#6b7280',
                color: article.sentiment === 'positive' ? '#10b981' : article.sentiment === 'negative' ? '#ef4444' : '#6b7280',
              }}
            >
              {article.sentiment === 'positive' && <TrendingUp className="w-4 h-4" />}
              {article.sentiment === 'negative' && <TrendingDown className="w-4 h-4" />}
              {article.sentiment === 'neutral' && <Minus className="w-4 h-4" />}
              {article.sentiment.toUpperCase()}
            </div>
          )}

          {/* Categories */}
          {article.category.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {article.category.slice(0, 3).map((cat) => (
                <span
                  key={cat}
                  className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}

          {/* Entities */}
          {article.entities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {article.entities.slice(0, 4).map((entity, idx) => (
                <span
                  key={idx}
                  className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded"
                >
                  {entity.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
