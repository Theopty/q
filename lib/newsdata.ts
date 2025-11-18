import axios from 'axios'
import { NewsArticleData, EntityData } from './types'

const NEWSDATA_API_URL = 'https://newsdata.io/api/1/news'

export interface NewsdataArticle {
  article_id: string
  title: string
  link: string
  keywords?: string[] | null
  creator?: string[] | null
  video_url?: string | null
  description?: string | null
  content?: string | null
  pubDate: string
  image_url?: string | null
  source_id: string
  source_priority: number
  source_url?: string
  source_icon?: string
  language: string
  country?: string[]
  category: string[]
  ai_tag?: string
  sentiment?: string
  sentiment_stats?: string
  ai_region?: string
  ai_org?: string
}

export interface NewsdataResponse {
  status: string
  totalResults: number
  results: NewsdataArticle[]
  nextPage?: string
}

/**
 * Major US news sources (national, not local)
 */
export const MAJOR_US_SOURCES = [
  'cnn', 'foxnews', 'nytimes', 'wsj', 'washingtonpost', 'usatoday',
  'nbcnews', 'abcnews', 'cbsnews', 'reuters', 'apnews', 'bloomberg',
  'cnbc', 'forbes', 'thehill', 'politico', 'npr', 'axios',
  'theguardian', 'bbc', 'time', 'newsweek', 'yahoo'
]

/**
 * Fetch news from Newsdata.io API
 */
export async function fetchNews(params: {
  q?: string // search query/keywords
  category?: string[] // news categories
  language?: string
  country?: string
  sentiment?: string
  from_date?: string // YYYY-MM-DD
  to_date?: string // YYYY-MM-DD
  page?: string
  prioritydomain?: string // 'top' for highest priority sources
}): Promise<NewsdataResponse> {
  const apiKey = process.env.NEWSDATA_API_KEY

  if (!apiKey) {
    throw new Error('NEWSDATA_API_KEY is not configured')
  }

  try {
    // Default to top news from US
    const requestParams: any = {
      apikey: apiKey,
      country: params.country || 'us',
      language: params.language || 'en',
      prioritydomain: 'top', // Get only top priority sources
      ...params,
      category: params.category?.join(','),
    }

    const response = await axios.get(NEWSDATA_API_URL, {
      params: requestParams,
    })

    // Filter to only major US sources (no local newspapers)
    const filteredResults = response.data.results.filter((article: NewsdataArticle) => {
      const source = article.source_id.toLowerCase()
      // Check if source is in major sources or has high priority
      return MAJOR_US_SOURCES.includes(source) || article.source_priority === 1
    })

    return {
      ...response.data,
      results: filteredResults,
      totalResults: filteredResults.length,
    }
  } catch (error) {
    console.error('Error fetching news from Newsdata.io:', error)
    throw error
  }
}

/**
 * Extract entities from news article using simple NLP patterns
 * In production, you might want to use a proper NLP service
 */
export function extractEntities(article: NewsdataArticle): EntityData[] {
  const entities: EntityData[] = []

  // Extract from AI tags if available
  if (article.ai_org) {
    entities.push({
      name: article.ai_org,
      type: 'organization'
    })
  }

  if (article.ai_region) {
    entities.push({
      name: article.ai_region,
      type: 'location'
    })
  }

  // You can enhance this with more sophisticated entity extraction
  // For now, we'll use the AI tags provided by Newsdata.io

  return entities
}

/**
 * Convert Newsdata.io article to our internal format
 */
export function convertToNewsArticle(article: NewsdataArticle): NewsArticleData {
  return {
    title: article.title,
    description: article.description,
    content: article.content,
    url: article.link,
    imageUrl: article.image_url,
    source: article.source_id,
    category: article.category || [],
    keywords: article.keywords || [],
    language: article.language,
    country: article.country?.[0],
    sentiment: article.sentiment,
    publishedAt: new Date(article.pubDate),
    entities: extractEntities(article),
  }
}

/**
 * Get available news categories
 */
export const NEWS_CATEGORIES = [
  'business',
  'entertainment',
  'environment',
  'food',
  'health',
  'politics',
  'science',
  'sports',
  'technology',
  'top',
  'tourism',
  'world',
]

/**
 * Get available countries
 */
export const NEWS_COUNTRIES = [
  'us', 'gb', 'ca', 'au', 'in', 'de', 'fr', 'jp', 'cn', 'br'
]

/**
 * Get available languages
 */
export const NEWS_LANGUAGES = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ar'
]
