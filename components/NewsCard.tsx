'use client'

import { ExternalLink, Calendar, Tag } from 'lucide-react'
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
  const getSentimentColor = (sentiment: string | null) => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300'
      case 'negative':
        return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300'
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      {article.imageUrl && (
        <img
          src={article.imageUrl}
          alt={article.title}
          className="w-full h-48 object-cover"
        />
      )}
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">
            {article.source}
          </span>
          {article.sentiment && (
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${getSentimentColor(
                article.sentiment
              )}`}
            >
              {article.sentiment}
            </span>
          )}
        </div>

        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-2">
          {article.title}
        </h3>

        {article.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">
            {article.description}
          </p>
        )}

        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-3">
          <Calendar className="w-3 h-3 mr-1" />
          {format(new Date(article.publishedAt), 'MMM dd, yyyy HH:mm')}
        </div>

        {article.category.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
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

        {article.keywords.length > 0 && (
          <div className="flex items-start gap-2 mb-3">
            <Tag className="w-3 h-3 mt-1 text-gray-400" />
            <div className="flex flex-wrap gap-1 flex-1">
              {article.keywords.slice(0, 4).map((keyword, idx) => (
                <span
                  key={idx}
                  className="text-xs text-gray-600 dark:text-gray-400"
                >
                  {keyword}
                  {idx < Math.min(3, article.keywords.length - 1) && ','}
                </span>
              ))}
            </div>
          </div>
        )}

        {article.entities.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Entities:
            </div>
            <div className="flex flex-wrap gap-1">
              {article.entities.slice(0, 3).map((entity, idx) => (
                <span
                  key={idx}
                  className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded"
                >
                  {entity.name} ({entity.type})
                </span>
              ))}
            </div>
          </div>
        )}

        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Read full article
          <ExternalLink className="w-3 h-3 ml-1" />
        </a>
      </div>
    </div>
  )
}
