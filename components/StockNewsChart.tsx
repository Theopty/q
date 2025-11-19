'use client'

import { useState, useEffect } from 'react'
import { Search, TrendingUp, TrendingDown, Minus, Filter, X, Plus, Newspaper } from 'lucide-react'
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
  keywords: string | string[]
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
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null)

  // Manual news fetch
  const [newsKeyword, setNewsKeyword] = useState('')
  const [newsDate, setNewsDate] = useState('')
  const [fetchingNews, setFetchingNews] = useState(false)
  const [fetchedNews, setFetchedNews] = useState<NewsArticle[]>([])
  const [showNewsResults, setShowNewsResults] = useState(false)
  const [showNewsQueryModal, setShowNewsQueryModal] = useState(false)

  // Add stock to watchlist
  const [newStockSymbol, setNewStockSymbol] = useState('')
  const [newStockName, setNewStockName] = useState('')
  const [addingStock, setAddingStock] = useState(false)
  const [showAddStockModal, setShowAddStockModal] = useState(false)

  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])

  // Filters - Chips
  const [selectedPeople, setSelectedPeople] = useState<string[]>([])
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([])
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])
  const [selectedSentiments, setSelectedSentiments] = useState<string[]>([])

  // Available filter options
  const [availablePeople, setAvailablePeople] = useState<string[]>([])
  const [availableOrganizations, setAvailableOrganizations] = useState<string[]>([])
  const [availableKeywords, setAvailableKeywords] = useState<string[]>([])

  // Active chips tab
  const [activeChipsTab, setActiveChipsTab] = useState<'people' | 'organizations' | 'keywords'>('people')

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
      const stockParams = new URLSearchParams({ symbol })
      const existingResponse = await axios.get(`/api/stocks?${stockParams.toString()}`)
      const existingData = existingResponse.data

      let needsBackfill = false
      let needsUpdate = false
      let backfillFrom = dateFrom
      let updateFrom = dateTo

      if (existingData.length > 0) {
        const sorted = [...existingData].sort((a: StockData, b: StockData) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )

        const oldestDate = new Date(sorted[0].timestamp)
        const newestDate = new Date(sorted[sorted.length - 1].timestamp)
        const requestedFrom = new Date(dateFrom)
        const requestedTo = new Date(dateTo)

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
        console.log(`Fetching ${symbol} from ${dateFrom} to ${dateTo}`)
        await axios.post('/api/stocks', { symbol, from: dateFrom, to: dateTo })
      }

      const finalParams = new URLSearchParams({ symbol, dateFrom, dateTo })
      const finalResponse = await axios.get(`/api/stocks?${finalParams.toString()}`)
      setStockData(finalResponse.data)

      try {
        await axios.post('/api/news/auto-fetch', {
          symbol,
          from_date: dateFrom,
          to_date: dateTo,
        })
      } catch (error) {
        console.log('Background news fetch skipped or failed')
      }

      const newsParams = new URLSearchParams({ dateFrom, dateTo })
      const newsResponse = await axios.get(`/api/news?${newsParams.toString()}`)
      const allNews = newsResponse.data

      const relevantNews = allNews.filter((article: NewsArticle) => {
        const titleAndEntities = `${article.title} ${article.entities.map(e => e.name).join(' ')}`.toLowerCase()
        return titleAndEntities.includes(symbol.toLowerCase())
      })

      setNewsArticles(relevantNews)

      // Extract categorized data for chips
      const people = Array.from(new Set(relevantNews.flatMap((a: NewsArticle) =>
        a.entities.filter(e => e.type === 'person').map(e => e.name)
      ))) as string[]
      const organizations = Array.from(new Set(relevantNews.flatMap((a: NewsArticle) =>
        a.entities.filter(e => e.type === 'organization').map(e => e.name)
      ))) as string[]
      const keywords = Array.from(new Set(relevantNews.flatMap((a: NewsArticle) => {
        const kw = typeof a.keywords === 'string' ? JSON.parse(a.keywords) : a.keywords
        return kw || []
      }))) as string[]

      setAvailablePeople(people)
      setAvailableOrganizations(organizations)
      setAvailableKeywords(keywords.filter(k => k && k.length > 0))

      combineChartData(finalResponse.data, relevantNews)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const combineChartData = (stocks: StockData[], news: NewsArticle[]) => {
    const dataMap = new Map<string, ChartDataPoint>()

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
      const sentimentMatch = selectedSentiments.length === 0 ||
        (article.sentiment && selectedSentiments.includes(article.sentiment))
      const peopleMatch = selectedPeople.length === 0 ||
        article.entities.some(e => e.type === 'person' && selectedPeople.includes(e.name))
      const orgMatch = selectedOrganizations.length === 0 ||
        article.entities.some(e => e.type === 'organization' && selectedOrganizations.includes(e.name))
      const keywordsArr = typeof article.keywords === 'string' ? JSON.parse(article.keywords) : article.keywords
      const keywordsMatch = selectedKeywords.length === 0 ||
        (keywordsArr || []).some((k: string) => selectedKeywords.includes(k))

      return sentimentMatch && peopleMatch && orgMatch && keywordsMatch
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

  const toggleChip = (chip: string, list: string[], setList: Function) => {
    if (list.includes(chip)) {
      setList(list.filter(c => c !== chip))
    } else {
      setList([...list, chip])
    }
  }

  const addStockToWatchlist = async () => {
    if (!newStockSymbol.trim()) {
      alert('Please enter a stock symbol (e.g., AAPL, TSLA)')
      return
    }

    setAddingStock(true)
    try {
      await axios.post('/api/stocks/watchlist', {
        symbol: newStockSymbol.toUpperCase().trim(),
        name: newStockName.trim() || newStockSymbol.toUpperCase().trim(),
      })

      await loadAvailableStocks()
      setNewStockSymbol('')
      setNewStockName('')
      alert(`${newStockSymbol.toUpperCase()} added to watchlist!`)
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error'
      if (errorMsg.includes('already in watchlist')) {
        alert(`${newStockSymbol.toUpperCase()} is already in your watchlist!`)
      } else {
        alert(`Failed to add stock: ${errorMsg}`)
      }
    } finally {
      setAddingStock(false)
    }
  }

  const fetchNewsByDate = async () => {
    if (!newsKeyword.trim() || !newsDate) {
      alert('Please enter a keyword and select a date')
      return
    }

    setFetchingNews(true)
    try {
      const postResponse = await axios.post('/api/news', {
        query: newsKeyword,
        from_date: newsDate,
        to_date: newsDate,
      })

      const { totalResults } = postResponse.data

      if (totalResults === 0) {
        alert(`WorldNewsAPI found 0 articles for "${newsKeyword}" on ${newsDate}.`)
        return
      }

      const newsParams = new URLSearchParams({ dateFrom: newsDate, dateTo: newsDate })
      const response = await axios.get(`/api/news?${newsParams.toString()}`)

      const filtered = response.data.filter((article: NewsArticle) => {
        const text = `${article.title} ${article.entities.map((e: any) => e.name).join(' ')}`.toLowerCase()
        return text.includes(newsKeyword.toLowerCase())
      })

      setFetchedNews(filtered.length > 0 ? filtered : response.data)
      setShowNewsResults(true)
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error'
      alert(`Failed to fetch news: ${errorMsg}`)
    } finally {
      setFetchingNews(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-800 flex flex-col h-screen">
        {/* Header */}
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-lg font-bold text-white tracking-tight mb-1">
            MARKET INTELLIGENCE
          </h1>
          <p className="text-[9px] text-gray-500 uppercase tracking-wider">Terminal v1.0</p>
        </div>

        {/* Sidebar Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Instrument Selector */}
          <div className="bg-gray-950 border border-gray-800 rounded-sm p-3">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              INSTRUMENT
            </label>
            <select
              value={selectedStock}
              onChange={(e) => selectStock(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="">-- SELECT --</option>
              {availableStocks.map((stock) => (
                <option key={stock.symbol} value={stock.symbol}>
                  {stock.symbol} | {stock.name}
                </option>
              ))}
            </select>

            {selectedStock && (
              <div className="mt-3 space-y-2">
                <div>
                  <label className="block text-[9px] font-bold text-gray-600 uppercase mb-1">START</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 text-white font-mono text-[10px] focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-600 uppercase mb-1">END</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 text-white font-mono text-[10px] focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={() => loadStockAndNews(selectedStock)}
                  className="w-full px-3 py-2 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-blue-700"
                >
                  REFRESH
                </button>
              </div>
            )}
          </div>

          {/* Sentiment Filter */}
          {selectedStock && chartData.length > 0 && (
            <div className="bg-gray-950 border border-gray-800 rounded-sm p-3">
              <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">SENTIMENT</h2>
              <div className="space-y-1.5">
                {['positive', 'neutral', 'negative'].map((sentiment) => (
                  <label key={sentiment} className="flex items-center cursor-pointer hover:bg-gray-900 px-2 py-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedSentiments.includes(sentiment)}
                      onChange={() => toggleChip(sentiment, selectedSentiments, setSelectedSentiments)}
                      className="w-3 h-3 rounded border-gray-600 bg-gray-800 text-blue-500"
                    />
                    <span className={`ml-2 text-[10px] font-bold uppercase ${
                      sentiment === 'positive' ? 'text-green-500' :
                      sentiment === 'negative' ? 'text-red-500' : 'text-gray-400'
                    }`}>{sentiment}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* System Status */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-gray-600 uppercase tracking-wider">STATUS</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[9px] text-green-500 font-mono">LIVE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Bar */}
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            {selectedStock ? `${selectedStock} ANALYSIS` : 'PRICE CHART · NEWS CORRELATION'}
          </h2>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {!selectedStock ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Search className="w-16 h-16 mx-auto text-gray-700 mb-4" />
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">
                  NO INSTRUMENT SELECTED
                </h3>
                <p className="text-xs text-gray-600 font-mono">
                  → Select a ticker from the sidebar
                </p>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin w-12 h-12 border-2 border-blue-600 border-t-transparent rounded-sm mx-auto mb-4"></div>
                <p className="text-xs text-gray-400 font-mono uppercase">LOADING DATA...</p>
              </div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-xs text-gray-500 font-mono">
                  ⚠ NO DATA AVAILABLE<br/>
                  <span className="text-gray-600 mt-2 inline-block">Click REFRESH to fetch data</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-3">
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

              {/* Chips Section */}
              <div className="bg-gray-950 border border-gray-800 rounded-sm p-4">
                <div className="flex items-center gap-2 mb-3 border-b border-gray-800 pb-2">
                  <button
                    onClick={() => setActiveChipsTab('people')}
                    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      activeChipsTab === 'people' ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'
                    }`}
                  >
                    PEOPLE ({availablePeople.length})
                  </button>
                  <button
                    onClick={() => setActiveChipsTab('organizations')}
                    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      activeChipsTab === 'organizations' ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'
                    }`}
                  >
                    ORGANIZATIONS ({availableOrganizations.length})
                  </button>
                  <button
                    onClick={() => setActiveChipsTab('keywords')}
                    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      activeChipsTab === 'keywords' ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'
                    }`}
                  >
                    KEYWORDS ({availableKeywords.length})
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 min-h-[60px]">
                  {activeChipsTab === 'people' && availablePeople.map((person) => (
                    <button
                      key={person}
                      onClick={() => toggleChip(person, selectedPeople, setSelectedPeople)}
                      className={`px-3 py-1.5 text-[10px] font-mono rounded-sm transition-all ${
                        selectedPeople.includes(person)
                          ? 'bg-purple-600 text-white border-2 border-purple-400'
                          : 'bg-gray-900 text-gray-400 border border-gray-700 hover:border-purple-600'
                      }`}
                    >
                      {person}
                    </button>
                  ))}
                  {activeChipsTab === 'organizations' && availableOrganizations.map((org) => (
                    <button
                      key={org}
                      onClick={() => toggleChip(org, selectedOrganizations, setSelectedOrganizations)}
                      className={`px-3 py-1.5 text-[10px] font-mono rounded-sm transition-all ${
                        selectedOrganizations.includes(org)
                          ? 'bg-blue-600 text-white border-2 border-blue-400'
                          : 'bg-gray-900 text-gray-400 border border-gray-700 hover:border-blue-600'
                      }`}
                    >
                      {org}
                    </button>
                  ))}
                  {activeChipsTab === 'keywords' && availableKeywords.map((keyword) => (
                    <button
                      key={keyword}
                      onClick={() => toggleChip(keyword, selectedKeywords, setSelectedKeywords)}
                      className={`px-3 py-1.5 text-[10px] font-mono rounded-sm transition-all ${
                        selectedKeywords.includes(keyword)
                          ? 'bg-green-600 text-white border-2 border-green-400'
                          : 'bg-gray-900 text-gray-400 border border-gray-700 hover:border-green-600'
                      }`}
                    >
                      {keyword}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart */}
              <div className="bg-gray-950 border border-gray-800 rounded-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">PRICE CHART</div>
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

                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={filteredChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '10px', fontFamily: 'monospace' }} />
                    <YAxis stroke="#6b7280" style={{ fontSize: '10px', fontFamily: 'monospace' }} />
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

              {/* News Feed */}
              <div className="bg-gray-950 border border-gray-800 rounded-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    NEWS FEED · {filteredChartData.reduce((sum, point) => sum + point.news.length, 0)} ARTICLES
                  </h3>
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
                        </div>
                        <h4 className="text-xs font-medium text-gray-300 hover:text-white transition-colors line-clamp-2">
                          {article.title}
                        </h4>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-40">
        <button
          onClick={() => setShowNewsQueryModal(true)}
          className="w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm shadow-lg flex items-center justify-center transition-all hover:scale-110 border border-emerald-500"
          title="News Query"
        >
          <Newspaper className="w-6 h-6" />
        </button>
        <button
          onClick={() => setShowAddStockModal(true)}
          className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-sm shadow-lg flex items-center justify-center transition-all hover:scale-110 border border-blue-500"
          title="Add Instrument"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Add Stock Modal */}
      {showAddStockModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50" onClick={() => setShowAddStockModal(false)}>
          <div className="bg-gray-950 border border-gray-800 shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                ADD INSTRUMENT
              </h2>
              <button onClick={() => setShowAddStockModal(false)} className="p-2 hover:bg-gray-800">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  SYMBOL
                </label>
                <input
                  type="text"
                  value={newStockSymbol}
                  onChange={(e) => setNewStockSymbol(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && addStockToWatchlist()}
                  placeholder="e.g., AAPL, TSLA"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-white font-mono text-sm uppercase focus:outline-none focus:border-blue-500 placeholder-gray-600"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  NAME (OPTIONAL)
                </label>
                <input
                  type="text"
                  value={newStockName}
                  onChange={(e) => setNewStockName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addStockToWatchlist()}
                  placeholder="Company name"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-white font-mono text-sm focus:outline-none focus:border-blue-500 placeholder-gray-600"
                />
              </div>
              <button
                onClick={() => {
                  addStockToWatchlist()
                  setShowAddStockModal(false)
                }}
                disabled={addingStock}
                className="w-full px-4 py-3 bg-blue-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                {addingStock ? 'ADDING...' : 'ADD TO WATCHLIST'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* News Query Modal */}
      {showNewsQueryModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50" onClick={() => setShowNewsQueryModal(false)}>
          <div className="bg-gray-950 border border-gray-800 shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                NEWS QUERY
              </h2>
              <button onClick={() => setShowNewsQueryModal(false)} className="p-2 hover:bg-gray-800">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  KEYWORD
                </label>
                <input
                  type="text"
                  value={newsKeyword}
                  onChange={(e) => setNewsKeyword(e.target.value)}
                  placeholder="e.g., Apple, Tesla, Bitcoin"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-white font-mono text-sm focus:outline-none focus:border-emerald-500 placeholder-gray-600"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  DATE
                </label>
                <input
                  type="date"
                  value={newsDate}
                  onChange={(e) => setNewsDate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                onClick={() => {
                  fetchNewsByDate()
                  setShowNewsQueryModal(false)
                }}
                disabled={fetchingNews}
                className="w-full px-4 py-3 bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                {fetchingNews ? 'FETCHING...' : 'EXECUTE QUERY'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* News Results Modal */}
      {showNewsResults && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50" onClick={() => setShowNewsResults(false)}>
          <div className="bg-gray-950 border border-gray-800 shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                QUERY RESULTS: "{newsKeyword}"
              </h2>
              <button onClick={() => setShowNewsResults(false)} className="p-2 hover:bg-gray-800">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {fetchedNews.map((article) => (
                <div key={article.id} className="flex items-start gap-3 p-3 border border-gray-800 bg-gray-900/50">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-200 mb-2">{article.title}</h4>
                    <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400">
                      VIEW SOURCE →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Article Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50" onClick={() => setSelectedArticle(null)}>
          <div className="bg-gray-950 border border-gray-800 shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-800">
              <h2 className="text-base font-bold text-white">{selectedArticle.title}</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <a href={selectedArticle.url} target="_blank" rel="noopener noreferrer" className="inline-block px-4 py-2 bg-blue-600 text-white text-xs font-bold uppercase">
                OPEN ARTICLE →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
