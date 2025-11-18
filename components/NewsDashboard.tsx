'use client'

import { useState, useEffect } from 'react'
import { Search, RefreshCw, Filter } from 'lucide-react'
import axios from 'axios'
import { NEWS_CATEGORIES } from '@/lib/newsdata'
import NewsCard from './NewsCard'
import NewsFilters from './NewsFilters'

interface NewsArticle {
  id: string
  title: string
  description: string | null
  content: string | null
  url: string
  imageUrl: string | null
  source: string
  category: string[]
  keywords: string[]
  sentiment: string | null
  publishedAt: string
  entities: Array<{ name: string; type: string }>
}

export default function NewsDashboard() {
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchingNew, setFetchingNew] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    keywords: [] as string[],
    categories: [] as string[],
    sources: [] as string[],
    sentiment: '',
    dateFrom: '',
    dateTo: '',
    entity: '',
  })

  const fetchArticles = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.keywords.length > 0) params.append('keywords', filters.keywords.join(','))
      if (filters.categories.length > 0) params.append('categories', filters.categories.join(','))
      if (filters.sources.length > 0) params.append('sources', filters.sources.join(','))
      if (filters.sentiment) params.append('sentiment', filters.sentiment)
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.append('dateTo', filters.dateTo)
      if (filters.entity) params.append('entity', filters.entity)

      const response = await axios.get(`/api/news?${params.toString()}`)
      setArticles(response.data)
    } catch (error) {
      console.error('Error fetching articles:', error)
      alert('Failed to fetch articles')
    } finally {
      setLoading(false)
    }
  }

  const fetchNewArticles = async () => {
    setFetchingNew(true)
    try {
      const params: any = {}
      if (searchQuery) params.query = searchQuery
      if (filters.categories.length > 0) params.category = filters.categories
      if (filters.sentiment) params.sentiment = filters.sentiment

      const response = await axios.post('/api/news', params)
      alert(response.data.message)
      fetchArticles() // Refresh the list
    } catch (error) {
      console.error('Error fetching new articles:', error)
      alert('Failed to fetch new articles from Newsdata.io')
    } finally {
      setFetchingNew(false)
    }
  }

  useEffect(() => {
    fetchArticles()
  }, [])

  return (
    <div className="space-y-6">
      {/* Search and Actions Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search keywords (e.g., 'Apple', 'Tesla', 'Bitcoin')..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
            <button
              onClick={fetchNewArticles}
              disabled={fetchingNew}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              {fetchingNew ? 'Fetching...' : 'Fetch News'}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <button
              onClick={fetchArticles}
              disabled={loading}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <NewsFilters
            filters={filters}
            onFiltersChange={setFilters}
            onApply={fetchArticles}
          />
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Articles</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{articles.length}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400">Positive</div>
          <div className="text-3xl font-bold text-green-600">
            {articles.filter((a) => a.sentiment === 'positive').length}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400">Negative</div>
          <div className="text-3xl font-bold text-red-600">
            {articles.filter((a) => a.sentiment === 'negative').length}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400">Neutral</div>
          <div className="text-3xl font-bold text-gray-600">
            {articles.filter((a) => a.sentiment === 'neutral' || !a.sentiment).length}
          </div>
        </div>
      </div>

      {/* Articles Grid */}
      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading articles...</p>
        </div>
      ) : articles.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            No articles found. Try fetching news with the search button above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article) => (
            <NewsCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  )
}
