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
  const [availableStocks, setAvailableStocks] = useState<Array<{ symbol: string; name: string }>>([])
  const [stockData, setStockData] = useState<StockData[]>([])
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([])
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null)

  // Manual news fetch
  const [newsKeyword, setNewsKeyword] = useState('')
  const [newsDate, setNewsDate] = useState('')
  const [fetchingNews, setFetchingNews] = useState(false)
  const [fetchedNews, setFetchedNews] = useState<NewsArticle[]>([])
  const [showNewsResults, setShowNewsResults] = useState(false)

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

  // Load available stocks from database on mount
  useEffect(() => {
    loadAvailableStocks()
  }, [])

  const loadAvailableStocks = async () => {
    try {
      const response = await axios.get('/api/stocks/watchlist')
      setAvailableStocks(response.data)
    } catch (error) {
      console.error('Error loading stocks:', error)
    }
  }

  const selectStock = async (symbol: string) => {
    if (!symbol) {
      setSelectedStock('')
      setStockData([])
      setNewsArticles([])
      setChartData([])
      return
    }

    setSelectedStock(symbol)
    await loadStockAndNews(symbol)
  }

  const loadStockAndNews = async (symbol: string) => {
    setLoading(true)
    try {
      // Get existing stock data from database
      const stockParams = new URLSearchParams({ symbol })
      const existingResponse = await axios.get(`/api/stocks?${stockParams.toString()}`)
      const existingData = existingResponse.data

      // Determine date gaps to fetch
      let needsBackfill = false
      let needsUpdate = false
      let backfillFrom = dateFrom
      let updateFrom = dateTo

      if (existingData.length > 0) {
        // Sort by timestamp
        const sorted = [...existingData].sort((a: StockData, b: StockData) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )

        const oldestDate = new Date(sorted[0].timestamp)
        const newestDate = new Date(sorted[sorted.length - 1].timestamp)
        const requestedFrom = new Date(dateFrom)
        const requestedTo = new Date(dateTo)

        // Check if we need to backfill historical data
        if (requestedFrom < oldestDate) {
          needsBackfill = true
          backfillFrom = dateFrom
          const dayBeforeOldest = new Date(oldestDate)
          dayBeforeOldest.setDate(dayBeforeOldest.getDate() - 1)
          const backfillTo = dayBeforeOldest.toISOString().split('T')[0]

          console.log(`Backfilling ${symbol} from ${backfillFrom} to ${backfillTo}`)
          await axios.post('/api/stocks', {
            symbol,
            from: backfillFrom,
            to: backfillTo
          })
        }

        // Check if we need to fetch recent data
        if (requestedTo > newestDate) {
          needsUpdate = true
          const dayAfterNewest = new Date(newestDate)
          dayAfterNewest.setDate(dayAfterNewest.getDate() + 1)
          updateFrom = dayAfterNewest.toISOString().split('T')[0]

          console.log(`Updating ${symbol} from ${updateFrom} to ${dateTo}`)
          await axios.post('/api/stocks', {
            symbol,
            from: updateFrom,
            to: dateTo
          })
        }
      } else {
        // No data exists, fetch entire range
        console.log(`Fetching ${symbol} from ${dateFrom} to ${dateTo}`)
        await axios.post('/api/stocks', { symbol, from: dateFrom, to: dateTo })
      }

      // Reload all data for the requested range
      const finalParams = new URLSearchParams({ symbol, dateFrom, dateTo })
      const finalResponse = await axios.get(`/api/stocks?${finalParams.toString()}`)
      setStockData(finalResponse.data)

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
      const sources = Array.from(new Set(relevantNews.map((a: NewsArticle) => a.source))) as string[]
      const entities = Array.from(new Set(relevantNews.flatMap((a: NewsArticle) => a.entities.map(e => e.name)))) as string[]
      setAvailableSources(sources)
      setAvailableEntities(entities)

      // Combine data for chart
      combineChartData(finalResponse.data, relevantNews)
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

  const fetchNewsByDate = async () => {
    if (!newsKeyword.trim()) {
      alert('Please enter a keyword')
      return
    }
    if (!newsDate) {
      alert('Please select a date')
      return
    }

    setFetchingNews(true)
    try {
      // Fetch news from API
      await axios.post('/api/news', {
        query: newsKeyword,
        from_date: newsDate,
        to_date: newsDate,
      })

      // Then get from database
      const newsParams = new URLSearchParams({
        dateFrom: newsDate,
        dateTo: newsDate,
      })
      const response = await axios.get(`/api/news?${newsParams.toString()}`)

      // Filter for the keyword
      const filtered = response.data.filter((article: NewsArticle) => {
        const text = `${article.title} ${article.entities.map((e: any) => e.name).join(' ')}`.toLowerCase()
        return text.includes(newsKeyword.toLowerCase())
      })

      setFetchedNews(filtered)
      setShowNewsResults(true)
    } catch (error) {
      console.error('Error fetching news:', error)
      alert('Failed to fetch news. Please check your API key and try again.')
    } finally {
      setFetchingNews(false)
    }
  }

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="container mx-auto max-w-[1800px]">
        {/* Header */}
        <div className="mb-6 border-b border-gray-800 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight mb-1">
                MARKET INTELLIGENCE TERMINAL
              </h1>
              <p className="text-xs text-gray-500 uppercase tracking-wider">
                Real-time stock analysis with sentiment-driven news correlation
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 uppercase tracking-wider">SYSTEM STATUS</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-500 font-mono">LIVE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <div className="bg-gray-950 border border-gray-800 rounded-sm p-4 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[300px]">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                INSTRUMENT
              </label>
              <select
                value={selectedStock}
                onChange={(e) => selectStock(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-white font-mono text-sm focus:outline-none focus:border-blue-500 hover:border-gray-600 transition-colors"
              >
                <option value="">-- SELECT TICKER --</option>
                {availableStocks.map((stock) => (
                  <option key={stock.symbol} value={stock.symbol}>
                    {stock.symbol} | {stock.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedStock && (
              <>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    START
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="px-3 py-2 bg-gray-900 border border-gray-700 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    END
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="px-3 py-2 bg-gray-900 border border-gray-700 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="pt-5">
                  <button
                    onClick={() => loadStockAndNews(selectedStock)}
                    className="px-4 py-2 bg-blue-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-blue-700 transition-colors"
                  >
                    REFRESH
                  </button>
                </div>
                <div className="pt-5">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="px-4 py-2 bg-gray-800 border border-gray-700 text-gray-300 text-xs font-bold uppercase tracking-wider hover:bg-gray-700 transition-colors flex items-center gap-2"
                  >
                    <Filter className="w-3 h-3" />
                    FILTERS ({selectedSources.length + selectedEntities.length + selectedSentiments.length})
                  </button>
                </div>
              </>
            )}
          </div>

          {availableStocks.length === 0 && (
            <p className="text-xs text-gray-600 mt-3 font-mono">
              → No instruments loaded. Fetch news data to populate watchlist.
            </p>
          )}
        </div>

        {/* News Search Module */}
        <div className="bg-gray-950 border border-gray-800 rounded-sm p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              NEWS QUERY
            </h2>
            <div className="text-[9px] text-gray-600 font-mono">EXTERNAL FETCH</div>
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                KEYWORD
              </label>
              <input
                type="text"
                value={newsKeyword}
                onChange={(e) => setNewsKeyword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && fetchNewsByDate()}
                placeholder="Enter topic..."
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-white font-mono text-xs focus:outline-none focus:border-blue-500 placeholder-gray-600"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                TARGET DATE
              </label>
              <input
                type="date"
                value={newsDate}
                onChange={(e) => setNewsDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={fetchNewsByDate}
              disabled={fetchingNews}
              className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Search className="w-3 h-3" />
              {fetchingNews ? 'FETCHING...' : 'EXECUTE'}
            </button>
          </div>
        </div>

        {/* News Results Modal */}
        {showNewsResults && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50" onClick={() => setShowNewsResults(false)}>
            <div className="bg-gray-950 border border-gray-800 shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    QUERY RESULTS: "{newsKeyword}"
                  </h2>
                  <p className="text-[10px] text-gray-500 font-mono mt-1">
                    {newsDate && `${format(new Date(newsDate), 'yyyy-MM-dd')}`} · {fetchedNews.length} RECORDS
                  </p>
                </div>
                <button
                  onClick={() => setShowNewsResults(false)}
                  className="p-2 hover:bg-gray-800 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {fetchedNews.length === 0 ? (
                  <div className="text-center py-20">
                    <p className="text-xs text-gray-500 font-mono">
                      ⚠ NO RESULTS FOUND<br/>
                      <span className="text-gray-600 mt-2 inline-block">Modify search parameters and retry</span>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fetchedNews.map((article) => (
                      <div
                        key={article.id}
                        className="flex items-start gap-3 p-3 border border-gray-800 bg-gray-900/50 hover:border-blue-600 hover:bg-gray-900 transition-all"
                      >
                        <div className={`w-10 h-10 flex items-center justify-center flex-shrink-0 ${
                          article.sentiment === 'positive' ? 'bg-green-500/10 text-green-500' :
                          article.sentiment === 'negative' ? 'bg-red-500/10 text-red-500' :
                          'bg-gray-700/50 text-gray-500'
                        }`}>
                          {article.sentiment === 'positive' && <TrendingUp className="w-5 h-5" />}
                          {article.sentiment === 'negative' && <TrendingDown className="w-5 h-5" />}
                          {article.sentiment === 'neutral' && <Minus className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[9px] font-bold text-blue-400 uppercase font-mono">{article.source}</span>
                            <span className="text-[9px] text-gray-600 font-mono">
                              {format(new Date(article.publishedAt), 'MMM dd, HH:mm')}
                            </span>
                            {article.sentiment && (
                              <span className={`text-[8px] px-1.5 py-0.5 font-bold uppercase ${
                                article.sentiment === 'positive' ? 'bg-green-500/20 text-green-500' :
                                article.sentiment === 'negative' ? 'bg-red-500/20 text-red-500' :
                                'bg-gray-700 text-gray-400'
                              }`}>
                                {article.sentiment === 'positive' ? 'POS' : article.sentiment === 'negative' ? 'NEG' : 'NEU'}
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-medium text-gray-200 mb-2">
                            {article.title}
                          </h4>
                          {article.entities.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {article.entities.slice(0, 5).map((entity, idx) => (
                                <span key={idx} className="text-[8px] px-1.5 py-0.5 bg-purple-500/10 text-purple-400 font-mono uppercase">
                                  {entity.name}
                                </span>
                              ))}
                            </div>
                          )}
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-[10px] text-blue-400 hover:text-blue-300 font-mono uppercase tracking-wider"
                          >
                            VIEW SOURCE →
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        {showFilters && selectedStock && (
          <div className="bg-gray-950 border border-gray-800 rounded-sm p-4 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">DATA FILTERS</h3>
              <button
                onClick={() => {
                  setSelectedSources([])
                  setSelectedEntities([])
                  setSelectedSentiments([])
                }}
                className="px-3 py-1 bg-gray-800 border border-gray-700 text-gray-400 text-[9px] font-bold uppercase tracking-wider hover:bg-gray-700 transition-colors"
              >
                RESET ALL
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Sources */}
              <div>
                <h4 className="text-[9px] font-bold text-blue-400 uppercase tracking-wider mb-2 border-b border-gray-800 pb-1">SOURCES</h4>
                <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                  {availableSources.map((source) => (
                    <label key={source} className="flex items-center cursor-pointer hover:bg-gray-900 px-2 py-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedSources.includes(source)}
                        onChange={() => toggleFilter(selectedSources, setSelectedSources, source)}
                        className="w-3 h-3 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-0 focus:ring-offset-0"
                      />
                      <span className="ml-2 text-[10px] text-gray-400 uppercase font-mono">{source}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Entities */}
              <div>
                <h4 className="text-[9px] font-bold text-blue-400 uppercase tracking-wider mb-2 border-b border-gray-800 pb-1">ENTITIES</h4>
                <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                  {availableEntities.map((entity) => (
                    <label key={entity} className="flex items-center cursor-pointer hover:bg-gray-900 px-2 py-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedEntities.includes(entity)}
                        onChange={() => toggleFilter(selectedEntities, setSelectedEntities, entity)}
                        className="w-3 h-3 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-0 focus:ring-offset-0"
                      />
                      <span className="ml-2 text-[10px] text-gray-300 font-mono">{entity}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sentiment */}
              <div>
                <h4 className="text-[9px] font-bold text-blue-400 uppercase tracking-wider mb-2 border-b border-gray-800 pb-1">SENTIMENT</h4>
                <div className="space-y-1.5">
                  {['positive', 'neutral', 'negative'].map((sentiment) => (
                    <label key={sentiment} className="flex items-center cursor-pointer hover:bg-gray-900 px-2 py-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedSentiments.includes(sentiment)}
                        onChange={() => toggleFilter(selectedSentiments, setSelectedSentiments, sentiment)}
                        className="w-3 h-3 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-0 focus:ring-offset-0"
                      />
                      <span className={`ml-2 text-[10px] font-bold uppercase ${
                        sentiment === 'positive' ? 'text-green-500' :
                        sentiment === 'negative' ? 'text-red-500' : 'text-gray-400'
                      }`}>{sentiment}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chart */}
        {!selectedStock ? (
          <div className="bg-gray-950 border border-gray-800 rounded-sm p-20 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 mx-auto mb-4 border-2 border-gray-700 rounded-sm flex items-center justify-center">
                <Search className="w-8 h-8 text-gray-700" />
              </div>
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">
                NO INSTRUMENT SELECTED
              </h2>
              <p className="text-xs text-gray-600 font-mono">
                → Select a ticker from the dropdown to load price data and news correlation analysis
              </p>
            </div>
          </div>
        ) : loading ? (
          <div className="bg-gray-950 border border-gray-800 rounded-sm p-20 text-center">
            <div className="animate-spin w-12 h-12 border-2 border-blue-600 border-t-transparent rounded-sm mx-auto mb-4"></div>
            <p className="text-xs text-gray-400 font-mono uppercase tracking-wider">LOADING DATA...</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="bg-gray-950 border border-gray-800 rounded-sm p-20 text-center">
            <p className="text-xs text-gray-500 font-mono">
              ⚠ NO DATA AVAILABLE FOR SELECTED RANGE<br/>
              <span className="text-gray-600 mt-2 inline-block">Adjust date parameters or fetch new data</span>
            </p>
          </div>
        ) : (
          <>
            {/* Price Stats */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="bg-gray-950 border border-gray-800 rounded-sm p-3">
                <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">CURRENT</div>
                <div className="text-xl font-mono font-bold text-white">
                  ${chartData[chartData.length - 1]?.price.toFixed(2) || '0.00'}
                </div>
              </div>
              <div className="bg-gray-950 border border-gray-800 rounded-sm p-3">
                <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">HIGH</div>
                <div className="text-xl font-mono font-bold text-green-500">
                  ${Math.max(...chartData.map(d => d.price)).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-950 border border-gray-800 rounded-sm p-3">
                <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">LOW</div>
                <div className="text-xl font-mono font-bold text-red-500">
                  ${Math.min(...chartData.map(d => d.price)).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-950 border border-gray-800 rounded-sm p-3">
                <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">NEWS EVENTS</div>
                <div className="text-xl font-mono font-bold text-blue-400">
                  {filteredChartData.reduce((sum, point) => sum + point.news.length, 0)}
                </div>
              </div>
            </div>

            <div className="bg-gray-950 border border-gray-800 rounded-sm p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">PRICE CHART · NEWS CORRELATION</h2>
                <div className="flex items-center gap-4 text-[9px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-gray-500 uppercase font-mono">POSITIVE</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                    <span className="text-gray-500 uppercase font-mono">NEUTRAL</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span className="text-gray-500 uppercase font-mono">NEGATIVE</span>
                  </div>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={500}>
                <ComposedChart data={filteredChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="date"
                    stroke="#6b7280"
                    style={{ fontSize: '10px', fontFamily: 'monospace' }}
                  />
                  <YAxis
                    stroke="#6b7280"
                    style={{ fontSize: '10px', fontFamily: 'monospace' }}
                  />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload || !payload[0]) return null
                    const data = payload[0].payload
                    return (
                      <div className="bg-gray-950 border border-gray-700 p-3 shadow-xl">
                        <p className="font-mono text-xs font-bold text-gray-400 uppercase">{data.date}</p>
                        <p className="text-sm font-mono font-bold text-white mt-1">${data.price.toFixed(2)}</p>
                        {data.news.length > 0 && (
                          <p className="text-[10px] text-blue-400 font-mono mt-2">
                            {data.news.length} EVENT{data.news.length > 1 ? 'S' : ''}
                          </p>
                        )}
                      </div>
                    )
                  }} />
                  <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} />
                  <Line type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={2} name="PRICE (USD)" dot={false} />
                  <Scatter dataKey="price" shape={<CustomDot />} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* News Summary */}
            <div className="bg-gray-950 border border-gray-800 rounded-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  NEWS FEED · {filteredChartData.reduce((sum, point) => sum + point.news.length, 0)} ARTICLES
                </h3>
                <div className="text-[9px] text-gray-600 font-mono">FILTERED VIEW</div>
              </div>
              <div className="space-y-2">
                {filteredChartData.flatMap(point => point.news).slice(0, 10).map((article) => (
                  <div
                    key={article.id}
                    className="flex items-start gap-3 p-3 border border-gray-800 bg-gray-900/50 hover:border-blue-600 hover:bg-gray-900 transition-all cursor-pointer"
                    onClick={() => setSelectedArticle(article)}
                  >
                    <div className={`w-10 h-10 flex items-center justify-center flex-shrink-0 ${
                      article.sentiment === 'positive' ? 'bg-green-500/10 text-green-500' :
                      article.sentiment === 'negative' ? 'bg-red-500/10 text-red-500' :
                      'bg-gray-700/50 text-gray-500'
                    }`}>
                      {article.sentiment === 'positive' && <TrendingUp className="w-5 h-5" />}
                      {article.sentiment === 'negative' && <TrendingDown className="w-5 h-5" />}
                      {article.sentiment === 'neutral' && <Minus className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-bold text-blue-400 uppercase font-mono">{article.source}</span>
                        <span className="text-[9px] text-gray-600 font-mono">
                          {format(new Date(article.publishedAt), 'MMM dd, HH:mm')}
                        </span>
                        {article.sentiment && (
                          <span className={`text-[8px] px-1.5 py-0.5 font-bold uppercase ${
                            article.sentiment === 'positive' ? 'bg-green-500/20 text-green-500' :
                            article.sentiment === 'negative' ? 'bg-red-500/20 text-red-500' :
                            'bg-gray-700 text-gray-400'
                          }`}>
                            {article.sentiment === 'positive' ? 'POS' : article.sentiment === 'negative' ? 'NEG' : 'NEU'}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-medium text-gray-300 hover:text-white transition-colors line-clamp-2">
                        {article.title}
                      </h4>
                      {article.entities.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {article.entities.slice(0, 3).map((entity, idx) => (
                            <span key={idx} className="text-[8px] px-1.5 py-0.5 bg-purple-500/10 text-purple-400 font-mono uppercase">
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
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50" onClick={() => setSelectedArticle(null)}>
            <div className="bg-gray-950 border border-gray-800 shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-gray-800 flex items-start justify-between">
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-bold text-blue-400 uppercase font-mono">{selectedArticle.source}</span>
                    <span className="text-[9px] text-gray-600 font-mono">
                      {format(new Date(selectedArticle.publishedAt), 'yyyy-MM-dd HH:mm')}
                    </span>
                    {selectedArticle.sentiment && (
                      <span className={`text-[8px] px-1.5 py-0.5 font-bold uppercase ${
                        selectedArticle.sentiment === 'positive' ? 'bg-green-500/20 text-green-500' :
                        selectedArticle.sentiment === 'negative' ? 'bg-red-500/20 text-red-500' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        SENTIMENT: {selectedArticle.sentiment === 'positive' ? 'POSITIVE' : selectedArticle.sentiment === 'negative' ? 'NEGATIVE' : 'NEUTRAL'}
                      </span>
                    )}
                  </div>
                  <h2 className="text-base font-bold text-white leading-tight">{selectedArticle.title}</h2>
                </div>
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="flex-shrink-0 p-2 hover:bg-gray-800 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {selectedArticle.entities.length > 0 && (
                  <div className="mb-4">
                    <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-2">EXTRACTED ENTITIES</div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedArticle.entities.map((entity, idx) => (
                        <span key={idx} className="text-[10px] px-2 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 font-mono">
                          {entity.name} <span className="text-purple-600">·</span> {entity.type.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <a
                  href={selectedArticle.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-2 bg-blue-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-blue-700 transition-colors"
                >
                  OPEN FULL ARTICLE →
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
