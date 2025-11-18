// Type definitions for the dashboard

export interface NewsArticleData {
  id?: string
  title: string
  description?: string | null
  content?: string | null
  url: string
  imageUrl?: string | null
  source: string
  category: string[]
  keywords: string[]
  language?: string
  country?: string | null
  sentiment?: string | null
  publishedAt: Date
  entities?: EntityData[]
}

export interface EntityData {
  name: string
  type: string
}

export interface NewsFilters {
  keywords?: string[]
  categories?: string[]
  sources?: string[]
  sentiment?: string
  dateFrom?: Date
  dateTo?: Date
  entities?: string[]
}

export interface StockDataPoint {
  id?: string
  symbol: string
  name?: string | null
  price: number
  open?: number | null
  high?: number | null
  low?: number | null
  close?: number | null
  volume?: bigint | null
  change?: number | null
  changePercent?: number | null
  timestamp: Date
}

export interface CorrelationDataPoint {
  date: Date
  stockPrice: number
  newsCount: number
  positiveSentiment: number
  negativeSentiment: number
  neutralSentiment: number
}

export interface WatchlistStock {
  id?: string
  symbol: string
  name: string
  addedAt?: Date
}
