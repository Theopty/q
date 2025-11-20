'use client'

import { useState, useEffect } from 'react'
import { Calendar, Trash2, Plus, ChevronDown, ChevronUp, Newspaper } from 'lucide-react'
import axios from 'axios'
import { format } from 'date-fns'

interface DateRange {
  from: string
  to: string
  articleCount: number
  fetchedAt: string
}

interface NewsQuery {
  id: string
  keyword: string
  dateRanges: DateRange[]
  totalArticles: number
  lastFetchedAt: string
  createdAt: string
}

export default function NewsQueryManager() {
  const [queries, setQueries] = useState<NewsQuery[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null)
  const [expandingQuery, setExpandingQuery] = useState<string | null>(null)
  const [expandFrom, setExpandFrom] = useState('')
  const [expandTo, setExpandTo] = useState('')

  // New query form
  const [newKeyword, setNewKeyword] = useState('')
  const [newFromDate, setNewFromDate] = useState('')
  const [newToDate, setNewToDate] = useState('')
  const [creatingQuery, setCreatingQuery] = useState(false)

  useEffect(() => {
    loadQueries()
  }, [])

  const loadQueries = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/news/queries')
      setQueries(response.data)
    } catch (error) {
      console.error('Error loading queries:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteQuery = async (id: string) => {
    if (!confirm('Are you sure you want to delete this query?')) return

    try {
      await axios.delete(`/api/news/queries?id=${id}`)
      setQueries(queries.filter(q => q.id !== id))
    } catch (error) {
      console.error('Error deleting query:', error)
      alert('Failed to delete query')
    }
  }

  const expandDateRange = async (queryId: string, keyword: string) => {
    if (!expandFrom || !expandTo) {
      alert('Please select both start and end dates')
      return
    }

    try {
      setLoading(true)

      // Fetch news for the new date range
      await axios.post('/api/news', {
        query: keyword,
        from_date: expandFrom,
        to_date: expandTo,
      })

      // Reload queries to show updated data
      await loadQueries()

      setExpandingQuery(null)
      setExpandFrom('')
      setExpandTo('')

      alert('Date range expanded successfully!')
    } catch (error: any) {
      console.error('Error expanding date range:', error)
      alert(`Failed to expand date range: ${error.response?.data?.error || error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (queryId: string) => {
    setExpandedQuery(expandedQuery === queryId ? null : queryId)
    setExpandingQuery(null)
  }

  const createNewQuery = async () => {
    if (!newKeyword.trim() || !newFromDate || !newToDate) {
      alert('Please enter keyword and select date range')
      return
    }

    try {
      setCreatingQuery(true)

      // Fetch news for the new query
      await axios.post('/api/news', {
        query: newKeyword,
        from_date: newFromDate,
        to_date: newToDate,
      })

      // Reload queries to show the new one
      await loadQueries()

      // Clear form
      setNewKeyword('')
      setNewFromDate('')
      setNewToDate('')

      alert('News query created successfully!')
    } catch (error: any) {
      console.error('Error creating query:', error)
      alert(`Failed to create query: ${error.response?.data?.error || error.message}`)
    } finally {
      setCreatingQuery(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* New Query Form */}
      <div className="bg-gray-950 border border-gray-800 rounded-sm p-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <Newspaper className="w-4 h-4" />
          CREATE NEWS QUERY
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              KEYWORD
            </label>
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="e.g., Tesla, Apple, Bitcoin"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-white font-mono text-sm focus:outline-none focus:border-emerald-500 placeholder-gray-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                FROM DATE
              </label>
              <input
                type="date"
                value={newFromDate}
                onChange={(e) => setNewFromDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                TO DATE
              </label>
              <input
                type="date"
                value={newToDate}
                onChange={(e) => setNewToDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <button
            onClick={createNewQuery}
            disabled={creatingQuery}
            className="w-full px-4 py-3 bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {creatingQuery ? 'FETCHING NEWS...' : 'CREATE QUERY'}
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && queries.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-2 border-emerald-600 border-t-transparent rounded-sm mx-auto mb-4"></div>
            <p className="text-xs text-gray-400 font-mono uppercase">Loading queries...</p>
          </div>
        </div>
      ) : queries.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <Newspaper className="w-16 h-16 mx-auto text-gray-700 mb-4" />
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">
              NO QUERIES YET
            </h3>
            <p className="text-xs text-gray-600 font-mono">
              → Use the form above to create your first news query
            </p>
          </div>
        </div>
      ) : (
        /* Query List */
        <div className="space-y-3">
      {queries.map((query) => (
        <div
          key={query.id}
          className="bg-gray-950 border border-gray-800 rounded-sm overflow-hidden"
        >
          {/* Query Header */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {query.keyword}
                </h3>
                <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 text-[10px] font-mono font-bold rounded-sm">
                  {query.totalArticles} ARTICLES
                </span>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-gray-500 font-mono">
                <span>
                  {query.dateRanges.length} DATE RANGE{query.dateRanges.length !== 1 ? 'S' : ''}
                </span>
                <span>
                  LAST FETCHED: {format(new Date(query.lastFetchedAt), 'MMM dd, HH:mm')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleExpand(query.id)}
                className="p-2 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                title={expandedQuery === query.id ? 'Collapse' : 'Expand'}
              >
                {expandedQuery === query.id ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => deleteQuery(query.id)}
                className="p-2 hover:bg-red-900/20 text-gray-400 hover:text-red-400 transition-colors"
                title="Delete query"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Expanded Details */}
          {expandedQuery === query.id && (
            <div className="border-t border-gray-800 p-4 space-y-3">
              <div>
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  DATE RANGES
                </h4>
                <div className="space-y-2">
                  {query.dateRanges
                    .sort((a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime())
                    .map((range, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-gray-900 border border-gray-800 rounded-sm"
                      >
                        <div className="flex items-center gap-3">
                          <Calendar className="w-3 h-3 text-gray-500" />
                          <span className="text-xs font-mono text-gray-300">
                            {format(new Date(range.from), 'MMM dd, yyyy')} → {format(new Date(range.to), 'MMM dd, yyyy')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-mono text-gray-500">
                            {range.articleCount} articles
                          </span>
                          <span className="text-[9px] font-mono text-gray-600">
                            {format(new Date(range.fetchedAt), 'HH:mm')}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Expand Date Range Section */}
              {expandingQuery === query.id ? (
                <div className="p-3 bg-gray-900 border border-gray-800 rounded-sm space-y-3">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    ADD NEW DATE RANGE
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-gray-600 uppercase mb-1">
                        FROM
                      </label>
                      <input
                        type="date"
                        value={expandFrom}
                        onChange={(e) => setExpandFrom(e.target.value)}
                        className="w-full px-2 py-1.5 bg-gray-950 border border-gray-700 text-white font-mono text-[10px] focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-gray-600 uppercase mb-1">
                        TO
                      </label>
                      <input
                        type="date"
                        value={expandTo}
                        onChange={(e) => setExpandTo(e.target.value)}
                        className="w-full px-2 py-1.5 bg-gray-950 border border-gray-700 text-white font-mono text-[10px] focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => expandDateRange(query.id, query.keyword)}
                      disabled={loading}
                      className="flex-1 px-3 py-2 bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {loading ? 'FETCHING...' : 'FETCH NEWS'}
                    </button>
                    <button
                      onClick={() => setExpandingQuery(null)}
                      className="px-3 py-2 bg-gray-800 text-gray-400 text-[10px] font-bold uppercase tracking-wider hover:bg-gray-700"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setExpandingQuery(query.id)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-800 text-gray-400 text-[10px] font-bold uppercase tracking-wider hover:bg-gray-800 hover:text-white hover:border-emerald-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-3 h-3" />
                  ADD DATE RANGE
                </button>
              )}
            </div>
          )}
        </div>
      ))}
        </div>
      )}
    </div>
  )
}
