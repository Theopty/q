'use client'

import { NEWS_CATEGORIES } from '@/lib/worldnews'

interface NewsFiltersProps {
  filters: {
    keywords: string[]
    categories: string[]
    sources: string[]
    sentiment: string
    dateFrom: string
    dateTo: string
    entity: string
  }
  onFiltersChange: (filters: any) => void
  onApply: () => void
}

export default function NewsFilters({ filters, onFiltersChange, onApply }: NewsFiltersProps) {
  const updateFilter = (key: string, value: any) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const toggleCategory = (category: string) => {
    const categories = filters.categories.includes(category)
      ? filters.categories.filter((c) => c !== category)
      : [...filters.categories, category]
    updateFilter('categories', categories)
  }

  return (
    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Categories */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Categories
          </label>
          <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-300 dark:border-gray-600 rounded-lg p-3">
            {NEWS_CATEGORIES.map((category) => (
              <label key={category} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.categories.includes(category)}
                  onChange={() => toggleCategory(category)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 capitalize">
                  {category}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Sentiment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Sentiment
          </label>
          <select
            value={filters.sentiment}
            onChange={(e) => updateFilter('sentiment', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="">All Sentiments</option>
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
            <option value="neutral">Neutral</option>
          </select>

          {/* Entity Filter */}
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 mt-4">
            Entity Name
          </label>
          <input
            type="text"
            value={filters.entity}
            onChange={(e) => updateFilter('entity', e.target.value)}
            placeholder="e.g., Apple, Tesla..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Date From
          </label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => updateFilter('dateFrom', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 mt-4">
            Date To
          </label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => updateFilter('dateTo', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={onApply}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Apply Filters
        </button>
        <button
          onClick={() => {
            onFiltersChange({
              keywords: [],
              categories: [],
              sources: [],
              sentiment: '',
              dateFrom: '',
              dateTo: '',
              entity: '',
            })
          }}
          className="px-6 py-2 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600"
        >
          Clear Filters
        </button>
      </div>
    </div>
  )
}
