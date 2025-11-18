'use client'

import { useState, useEffect } from 'react'
import { Search, Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import axios from 'axios'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'

interface StockData {
  id: string
  symbol: string
  price: number
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  volume: string | null
  change: number | null
  changePercent: number | null
  timestamp: string
}

interface WatchlistStock {
  id: string
  symbol: string
  name: string
}

export default function StockMarketDashboard() {
  const [watchlist, setWatchlist] = useState<WatchlistStock[]>([])
  const [selectedStock, setSelectedStock] = useState<string>('')
  const [stockData, setStockData] = useState<StockData[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ symbol: string; name: string }>>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchWatchlist = async () => {
    try {
      const response = await axios.get('/api/stocks/watchlist')
      setWatchlist(response.data)
    } catch (error) {
      console.error('Error fetching watchlist:', error)
    }
  }

  const fetchStockData = async (symbol: string) => {
    setLoading(true)
    setSelectedStock(symbol)
    try {
      const params = new URLSearchParams({ symbol })
      if (dateFrom) params.append('dateFrom', dateFrom)
      if (dateTo) params.append('dateTo', dateTo)

      const response = await axios.get(`/api/stocks?${params.toString()}`)
      setStockData(response.data)
    } catch (error) {
      console.error('Error fetching stock data:', error)
      alert('Failed to fetch stock data')
    } finally {
      setLoading(false)
    }
  }

  const fetchNewStockData = async (symbol: string) => {
    try {
      const params: any = { symbol }
      if (dateFrom) params.from = dateFrom
      if (dateTo) params.to = dateTo

      await axios.post('/api/stocks', params)
      alert('Stock data fetched and saved successfully')
      fetchStockData(symbol)
    } catch (error) {
      console.error('Error fetching new stock data:', error)
      alert('Failed to fetch new stock data from API')
    }
  }

  const searchStocks = async () => {
    if (!searchQuery) return
    try {
      const response = await axios.get(`/api/stocks?search=${searchQuery}`)
      setSearchResults(response.data)
    } catch (error) {
      console.error('Error searching stocks:', error)
    }
  }

  const addToWatchlist = async (symbol: string, name: string) => {
    try {
      await axios.post('/api/stocks/watchlist', { symbol, name })
      fetchWatchlist()
      setSearchResults([])
      setSearchQuery('')
    } catch (error: any) {
      if (error.response?.status === 409) {
        alert('Stock already in watchlist')
      } else {
        alert('Failed to add stock to watchlist')
      }
    }
  }

  const removeFromWatchlist = async (id: string) => {
    try {
      await axios.delete(`/api/stocks/watchlist?id=${id}`)
      fetchWatchlist()
      if (selectedStock === watchlist.find((s) => s.id === id)?.symbol) {
        setSelectedStock('')
        setStockData([])
      }
    } catch (error) {
      console.error('Error removing from watchlist:', error)
    }
  }

  useEffect(() => {
    fetchWatchlist()
  }, [])

  const chartData = stockData
    .slice()
    .reverse()
    .map((d) => ({
      date: format(new Date(d.timestamp), 'MMM dd'),
      price: d.close || d.price,
      volume: d.volume ? Number(d.volume) / 1000000 : 0,
    }))

  const latestData = stockData[0]

  return (
    <div className="space-y-6">
      {/* Stock Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add Stock to Watchlist</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchStocks()}
            placeholder="Search stocks (e.g., AAPL, TSLA, MSFT)..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <button
            onClick={searchStocks}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            Search
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-4 border border-gray-300 dark:border-gray-600 rounded-lg">
            {searchResults.map((result) => (
              <div
                key={result.symbol}
                className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
              >
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">{result.symbol}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{result.name}</div>
                </div>
                <button
                  onClick={() => addToWatchlist(result.symbol, result.name)}
                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Watchlist Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Watchlist</h2>
            {watchlist.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                No stocks in watchlist. Search and add stocks above.
              </p>
            ) : (
              <div className="space-y-2">
                {watchlist.map((stock) => (
                  <div
                    key={stock.id}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedStock === stock.symbol
                        ? 'bg-blue-100 dark:bg-blue-900'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div
                      onClick={() => fetchStockData(stock.symbol)}
                      className="flex-1"
                    >
                      <div className="font-semibold text-gray-900 dark:text-white">{stock.symbol}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">{stock.name}</div>
                    </div>
                    <button
                      onClick={() => removeFromWatchlist(stock.id)}
                      className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stock Chart and Data */}
        <div className="lg:col-span-3">
          {!selectedStock ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                Select a stock from the watchlist to view data
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stock Info Card */}
              {latestData && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedStock}</h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {format(new Date(latestData.timestamp), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                    <button
                      onClick={() => fetchNewStockData(selectedStock)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      Fetch Latest Data
                    </button>
                  </div>
                  <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Price</div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        ${(latestData.close || latestData.price).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Change</div>
                      <div
                        className={`text-2xl font-bold flex items-center ${
                          (latestData.change || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {(latestData.change || 0) >= 0 ? (
                          <TrendingUp className="w-5 h-5 mr-1" />
                        ) : (
                          <TrendingDown className="w-5 h-5 mr-1" />
                        )}
                        {latestData.changePercent?.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">High</div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        ${latestData.high?.toFixed(2) || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Low</div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        ${latestData.low?.toFixed(2) || 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Date Range Filter */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      From
                    </label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      To
                    </label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <button
                    onClick={() => fetchStockData(selectedStock)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Apply
                  </button>
                </div>
              </div>

              {/* Chart */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Price History</h3>
                {loading ? (
                  <div className="h-96 flex items-center justify-center">
                    <p className="text-gray-600 dark:text-gray-400">Loading...</p>
                  </div>
                ) : stockData.length === 0 ? (
                  <div className="h-96 flex items-center justify-center">
                    <p className="text-gray-600 dark:text-gray-400">
                      No data available. Click "Fetch Latest Data" to load stock data.
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="price"
                        stroke="#2563eb"
                        name="Price ($)"
                        strokeWidth={2}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="volume"
                        stroke="#10b981"
                        name="Volume (M)"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
