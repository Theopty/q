'use client'

import { useState, useEffect } from 'react'
import { Search, TrendingUp, TrendingDown, Minus, Filter, X } from 'lucide-react'
import axios from 'axios'
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceDot,
} from 'recharts'
import { format } from 'date-fns'

interface StockData {
  id: string
  symbol: string
  price: number
  close: number | null
  timestamp: string
}

interface NewsArticle {
  id: string
  title: string
  url: string
  source: string
  sentiment: string | null
  publishedAt: string
  entities: Array<{ name: string; type: string }>
}

interface ChartDataPoint {
  date: string
  timestamp: number
  price: number
  news: NewsArticle[]
}

export default function StockNewsChart() {
  const [selectedStock, setSelectedStock] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ symbol: string; name: string }>>([])
  const [stockData, setStockData] = useState<StockData[]>([])
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([])
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null)

  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])

  // Filters
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [selectedEntities, setSelectedEntities] = useState<string[]>([])
  const [selectedSentiments, setSelectedSentiments] = useState<string[]>([])

  // Available filter options
  const [availableSources, setAvailableSources] = useState<string[]>([])
  const [availableEntities, setAvailableEntities] = useState<string[]>([])

  const searchStocks = async () => {
    if (!searchQuery) return
    try {
      const response = await axios.get(`/api/stocks?search=${searchQuery}`)
      setSearchResults(response.data)
    } catch (error) {
      console.error('Error searching stocks:', error)
    }
  }

  const selectStock = async (symbol: string, name: string) => {
    setSelectedStock(symbol)
    setSearchResults([])
    setSearchQuery('')
    await loadStockAndNews(symbol)
  }

  const loadStockAndNews = async (symbol: string) => {
    setLoading(true)
    try {
      // Fetch stock data
      const stockParams = new URLSearchParams({ symbol, dateFrom, dateTo })
      let stockResponse = await axios.get(`/api/stocks?${stockParams.toString()}`)

      // If no data, fetch from API
      if (stockResponse.data.length === 0) {
        await axios.post('/api/stocks', { symbol, from: dateFrom, to: dateTo })
        stockResponse = await axios.get(`/api/stocks?${stockParams.toString()}`)
      }

      setStockData(stockResponse.data)

      // Auto-fetch news in background for this stock
      try {
        await axios.post('/api/news/auto-fetch', {
          symbol,
          from_date: dateFrom,
          to_date: dateTo,
        })
      } catch (error) {
        console.log('Background news fetch skipped or failed')
      }

      // Fetch news mentioning this stock or related entities
      const newsParams = new URLSearchParams({ dateFrom, dateTo })
      const newsResponse = await axios.get(`/api/news?${newsParams.toString()}`)
      const allNews = newsResponse.data

      // Filter news that mentions the stock symbol or company name
      const relevantNews = allNews.filter((article: NewsArticle) => {
        const titleAndEntities = `${article.title} ${article.entities.map(e => e.name).join(' ')}`.toLowerCase()
        return titleAndEntities.includes(symbol.toLowerCase())
      })

      setNewsArticles(relevantNews)

      // Extract unique sources and entities
      const sources = [...new Set(relevantNews.map((a: NewsArticle) => a.source))]
      const entities = [...new Set(relevantNews.flatMap((a: NewsArticle) => a.entities.map(e => e.name)))]
      setAvailableSources(sources)
      setAvailableEntities(entities)

      // Combine data for chart
      combineChartData(stockResponse.data, relevantNews)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const combineChartData = (stocks: StockData[], news: NewsArticle[]) => {
    const dataMap = new Map<string, ChartDataPoint>()

    // Add stock prices
    stocks.forEach((stock) => {
      const dateKey = format(new Date(stock.timestamp), 'MMM dd')
      const timestamp = new Date(stock.timestamp).getTime()

      if (!dataMap.has(dateKey)) {
        dataMap.set(dateKey, {
          date: dateKey,
          timestamp,
          price: stock.close || stock.price,
          news: [],
        })
      } else {
        const existing = dataMap.get(dateKey)!
        existing.price = stock.close || stock.price
      }
    })

    // Add news to corresponding dates
    news.forEach((article) => {
      const dateKey = format(new Date(article.publishedAt), 'MMM dd')
      const existing = dataMap.get(dateKey)

      if (existing) {
        existing.news.push(article)
      }
    })

    const sorted = Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp)
    setChartData(sorted)
  }

  // Apply filters
  const filteredChartData = chartData.map((point) => ({
    ...point,
    news: point.news.filter((article) => {
      const sourceMatch = selectedSources.length === 0 || selectedSources.includes(article.source)
      const entityMatch = selectedEntities.length === 0 ||
        article.entities.some(e => selectedEntities.includes(e.name))
      const sentimentMatch = selectedSentiments.length === 0 ||
        (article.sentiment && selectedSentiments.includes(article.sentiment))

      return sourceMatch && entityMatch && sentimentMatch
    })
  }))

  const getSentimentColor = (sentiment: string | null) => {
    switch (sentiment) {
      case 'positive': return '#10b981'
      case 'negative': return '#ef4444'
      default: return '#6b7280'
    }
  }

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props
    if (!payload.news || payload.news.length === 0) return null

    return (
      <g>
        {payload.news.map((article: NewsArticle, idx: number) => (
          <circle
            key={article.id}
            cx={cx}
            cy={cy - (idx * 8)}
            r={6}
            fill={getSentimentColor(article.sentiment)}
            stroke="#fff"
            strokeWidth={2}
            style={{ cursor: 'pointer' }}
            onClick={() => setSelectedArticle(article)}
          />
        ))}
      </g>
    )
  }

  const toggleFilter = (filterArray: string[], setFilter: Function, value: string) => {
    if (filterArray.includes(value)) {
      setFilter(filterArray.filter(v => v !== value))
    } else {
      setFilter([...filterArray, value])
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="container mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Stock & News Timeline
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Select a stock to see its price chart with news events overlaid
        </p>

        {/* Stock Search */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchStocks()}
                placeholder="Search for a stock (e.g., AAPL, TSLA, MSFT)..."
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />

              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {searchResults.map((result) => (
                    <div
                      key={result.symbol}
                      onClick={() => selectStock(result.symbol, result.name)}
                      className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                    >
                      <div className="font-semibold text-gray-900 dark:text-white">{result.symbol}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{result.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={searchStocks}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Search className="w-5 h-5" />
              Search
            </button>
          </div>

          {selectedStock && (
            <div className="mt-4 flex items-center gap-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{selectedStock}</div>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
              <button
                onClick={() => loadStockAndNews(selectedStock)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Update
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Filter News ({selectedSources.length + selectedEntities.length + selectedSentiments.length})
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        {showFilters && selectedStock && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Sources */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Sources</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availableSources.map((source) => (
                    <label key={source} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedSources.includes(source)}
                        onChange={() => toggleFilter(selectedSources, setSelectedSources, source)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 uppercase">{source}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Entities */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Entities</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availableEntities.map((entity) => (
                    <label key={entity} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedEntities.includes(entity)}
                        onChange={() => toggleFilter(selectedEntities, setSelectedEntities, entity)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{entity}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sentiment */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Sentiment</h3>
                <div className="space-y-2">
                  {['positive', 'neutral', 'negative'].map((sentiment) => (
                    <label key={sentiment} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedSentiments.includes(sentiment)}
                        onChange={() => toggleFilter(selectedSentiments, setSelectedSentiments, sentiment)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 capitalize">{sentiment}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  setSelectedSources([])
                  setSelectedEntities([])
                  setSelectedSentiments([])
                }}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}

        {/* Chart */}
        {!selectedStock ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
            <Search className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Search for a Stock to Begin
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Enter a stock symbol above to view its price chart with news events
            </p>
          </div>
        ) : loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading stock and news data...</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              No data found for this date range. Try adjusting the dates or fetching stock data first.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Price Chart with News Events</h2>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-green-500"></div>
                    <span className="text-gray-600 dark:text-gray-400">Positive News</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-gray-500"></div>
                    <span className="text-gray-600 dark:text-gray-400">Neutral News</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-red-500"></div>
                    <span className="text-gray-600 dark:text-gray-400">Negative News</span>
                  </div>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={500}>
                <ComposedChart data={filteredChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload || !payload[0]) return null
                    const data = payload[0].payload
                    return (
                      <div className="bg-white dark:bg-gray-800 p-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg">
                        <p className="font-bold text-gray-900 dark:text-white">{data.date}</p>
                        <p className="text-blue-600 dark:text-blue-400">Price: ${data.price.toFixed(2)}</p>
                        {data.news.length > 0 && (
                          <p className="text-gray-600 dark:text-gray-400 mt-2">
                            {data.news.length} news article{data.news.length > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    )
                  }} />
                  <Legend />
                  <Line type="monotone" dataKey="price" stroke="#2563eb" strokeWidth={3} name="Stock Price ($)" dot={false} />
                  <Scatter dataKey="price" shape={<CustomDot />} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* News Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                News Articles ({filteredChartData.reduce((sum, point) => sum + point.news.length, 0)})
              </h3>
              <div className="space-y-3">
                {filteredChartData.flatMap(point => point.news).slice(0, 10).map((article) => (
                  <div
                    key={article.id}
                    className="flex items-start gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-400 dark:hover:border-blue-600 transition-colors cursor-pointer"
                    onClick={() => setSelectedArticle(article)}
                  >
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      article.sentiment === 'positive' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' :
                      article.sentiment === 'negative' ? 'bg-red-100 dark:bg-red-900/30 text-red-600' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-600'
                    }`}>
                      {article.sentiment === 'positive' && <TrendingUp className="w-6 h-6" />}
                      {article.sentiment === 'negative' && <TrendingDown className="w-6 h-6" />}
                      {article.sentiment === 'neutral' && <Minus className="w-6 h-6" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">{article.source}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {format(new Date(article.publishedAt), 'MMM dd, yyyy HH:mm')}
                        </span>
                      </div>
                      <h4 className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                        {article.title}
                      </h4>
                      {article.entities.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {article.entities.slice(0, 3).map((entity, idx) => (
                            <span key={idx} className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                              {entity.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Article Modal */}
        {selectedArticle && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedArticle(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white pr-8">{selectedArticle.title}</h2>
                  <button
                    onClick={() => setSelectedArticle(null)}
                    className="flex-shrink-0 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase">{selectedArticle.source}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {format(new Date(selectedArticle.publishedAt), 'MMM dd, yyyy HH:mm')}
                  </span>
                  {selectedArticle.sentiment && (
                    <span className={`text-sm px-3 py-1 rounded-full font-bold ${
                      selectedArticle.sentiment === 'positive' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' :
                      selectedArticle.sentiment === 'negative' ? 'bg-red-100 dark:bg-red-900/30 text-red-600' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-600'
                    }`}>
                      {selectedArticle.sentiment.toUpperCase()}
                    </span>
                  )}
                </div>
                {selectedArticle.entities.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {selectedArticle.entities.map((entity, idx) => (
                      <span key={idx} className="text-sm px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                        {entity.name} ({entity.type})
                      </span>
                    ))}
                  </div>
                )}
                <a
                  href={selectedArticle.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Read Full Article →
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
