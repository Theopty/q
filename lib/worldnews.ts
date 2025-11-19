import axios from 'axios'
import { NewsArticleData, EntityData } from './types'

const WORLDNEWS_API_URL = 'https://api.worldnewsapi.com/search-news'

export interface WorldNewsArticle {
  id: number
  title: string
  text: string
  summary?: string
  url: string
  image?: string
  publish_date: string
  author?: string
  language: string
  source_country: string
  sentiment: number  // -1 to 1 scale
  authors?: string[]
  entities?: {
    organizations?: string[]
    persons?: string[]
    locations?: string[]
  }
}

export interface WorldNewsResponse {
  available: number
  number: number
  offset: number
  news: WorldNewsArticle[]
}

/**
 * Major US news sources (national, not local)
 */
export const MAJOR_US_SOURCES = [
  'cnn.com', 'foxnews.com', 'nytimes.com', 'wsj.com', 'washingtonpost.com', 'usatoday.com',
  'nbcnews.com', 'abcnews.go.com', 'cbsnews.com', 'reuters.com', 'apnews.com', 'bloomberg.com',
  'cnbc.com', 'forbes.com', 'thehill.com', 'politico.com', 'npr.org', 'axios.com',
  'theguardian.com', 'bbc.com', 'time.com', 'newsweek.com', 'yahoo.com'
]

/**
 * Fetch news from WorldNewsAPI
 */
export async function fetchNews(params: {
  text?: string // search query/keywords
  source_countries?: string
  language?: string
  earliest_publish_date?: string // YYYY-MM-DD
  latest_publish_date?: string // YYYY-MM-DD
  news_sources?: string
  number?: number
  offset?: number
}): Promise<WorldNewsResponse> {
  const apiKey = process.env.WORLDNEWS_API_KEY

  if (!apiKey) {
    throw new Error('WORLDNEWS_API_KEY is not configured')
  }

  try {
    // Map parameters to WorldNewsAPI format
    const requestParams: any = {
      'source-countries': params.source_countries || 'us',
      language: params.language || 'en',
      number: params.number || 50,
      offset: params.offset || 0,
    }

    // Add search query/text
    if (params.text) {
      requestParams.text = params.text
    }

    // Add date filters with correct parameter names
    if (params.earliest_publish_date) {
      requestParams['earliest-publish-date'] = params.earliest_publish_date
    }
    if (params.latest_publish_date) {
      requestParams['latest-publish-date'] = params.latest_publish_date
    }

    // Filter to major sources
    if (params.news_sources) {
      requestParams['news-sources'] = params.news_sources
    } else {
      requestParams['news-sources'] = MAJOR_US_SOURCES.join(',')
    }

    console.log('WorldNewsAPI Request:', requestParams)

    const response = await axios.get(WORLDNEWS_API_URL, {
      params: requestParams,
      headers: {
        'x-api-key': apiKey,
      },
    })

    console.log('WorldNewsAPI Response:', response.data.available, 'articles available')

    return response.data
  } catch (error: any) {
    console.error('Error fetching news from WorldNewsAPI:', error.response?.data || error.message)
    throw error
  }
}

/**
 * Convert sentiment score (-1 to 1) to text
 */
export function getSentimentText(score: number): string {
  if (score > 0.2) return 'positive'
  if (score < -0.2) return 'negative'
  return 'neutral'
}

/**
 * Extract entities from WorldNews article
 */
export function extractEntities(article: WorldNewsArticle): EntityData[] {
  const entities: EntityData[] = []

  if (article.entities?.organizations) {
    article.entities.organizations.forEach((org) => {
      entities.push({
        name: org,
        type: 'organization'
      })
    })
  }

  if (article.entities?.persons) {
    article.entities.persons.forEach((person) => {
      entities.push({
        name: person,
        type: 'person'
      })
    })
  }

  if (article.entities?.locations) {
    article.entities.locations.forEach((location) => {
      entities.push({
        name: location,
        type: 'location'
      })
    })
  }

  return entities
}

/**
 * Extract source domain from URL
 */
export function getSourceFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname
    // Remove www. prefix
    return hostname.replace('www.', '')
  } catch {
    return 'unknown'
  }
}

/**
 * Determine category from article content and entities
 */
export function guessCategory(article: WorldNewsArticle): string[] {
  const categories: string[] = []
  const text = (article.title + ' ' + article.text).toLowerCase()

  // Business keywords
  if (text.match(/\b(stock|market|economy|business|finance|company|trade|investment)\b/)) {
    categories.push('business')
  }

  // Technology keywords
  if (text.match(/\b(tech|software|ai|computer|internet|digital|cyber|data)\b/)) {
    categories.push('technology')
  }

  // Politics keywords
  if (text.match(/\b(president|congress|senate|election|government|political|bill|law|policy)\b/)) {
    categories.push('politics')
  }

  // Sports keywords
  if (text.match(/\b(sports?|game|team|player|championship|tournament|league|nfl|nba|mlb)\b/)) {
    categories.push('sports')
  }

  // Health keywords
  if (text.match(/\b(health|medical|doctor|hospital|disease|treatment|drug|vaccine)\b/)) {
    categories.push('health')
  }

  // Entertainment keywords
  if (text.match(/\b(movie|film|music|celebrity|actor|entertainment|show|netflix|streaming)\b/)) {
    categories.push('entertainment')
  }

  // Science keywords
  if (text.match(/\b(science|research|study|scientist|discovery|experiment|space|nasa)\b/)) {
    categories.push('science')
  }

  // Default to 'news' if no category found
  if (categories.length === 0) {
    categories.push('news')
  }

  return categories
}

/**
 * Convert WorldNewsAPI article to our internal format
 */
export function convertToNewsArticle(article: WorldNewsArticle): NewsArticleData {
  return {
    title: article.title,
    description: article.summary || article.text.substring(0, 200) + '...',
    content: article.text,
    url: article.url,
    imageUrl: article.image,
    source: getSourceFromUrl(article.url),
    category: guessCategory(article),
    keywords: [], // WorldNewsAPI doesn't provide keywords, could extract later
    language: article.language,
    country: article.source_country,
    sentiment: getSentimentText(article.sentiment),
    publishedAt: new Date(article.publish_date),
    entities: extractEntities(article),
  }
}

/**
 * Get available news categories
 */
export const NEWS_CATEGORIES = [
  'business',
  'entertainment',
  'health',
  'politics',
  'science',
  'sports',
  'technology',
  'news',
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
