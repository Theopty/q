import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchNews, convertToNewsArticle } from '@/lib/worldnews'

/**
 * POST /api/news/auto-fetch - Automatically fetch news for a stock symbol
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { symbol, from_date, to_date } = body

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      )
    }

    // Check if we already have recent news for this symbol
    const existingNews = await prisma.newsArticle.count({
      where: {
        OR: [
          { keywords: { contains: symbol.toLowerCase() } },
          { entities: { some: { name: { contains: symbol, mode: 'insensitive' } } } },
        ],
        publishedAt: {
          gte: from_date ? new Date(from_date) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          lte: to_date ? new Date(to_date) : new Date(),
        },
      },
    })

    // If we have enough news, skip fetching
    if (existingNews >= 5) {
      return NextResponse.json({
        message: `Already have ${existingNews} articles for ${symbol}`,
        cached: true,
        count: existingNews,
      })
    }

    // Fetch news from WorldNewsAPI
    const newsResponse = await fetchNews({
      text: symbol,
      language: 'en',
      source_countries: 'us',
      earliest_publish_date: from_date,
      latest_publish_date: to_date,
      number: 50,
    })

    // Store articles in database
    const savedArticles = []

    for (const article of newsResponse.news) {
      const newsArticle = convertToNewsArticle(article)

      // Check if article already exists
      const existing = await prisma.newsArticle.findFirst({
        where: { url: newsArticle.url },
      })

      if (!existing) {
        const saved = await prisma.newsArticle.create({
          data: {
            title: newsArticle.title,
            description: newsArticle.description,
            content: newsArticle.content,
            url: newsArticle.url,
            imageUrl: newsArticle.imageUrl,
            source: newsArticle.source,
            category: JSON.stringify(newsArticle.category),
            keywords: JSON.stringify([...newsArticle.keywords, symbol.toLowerCase()]),
            language: newsArticle.language || 'en',
            country: newsArticle.country,
            sentiment: newsArticle.sentiment,
            publishedAt: newsArticle.publishedAt,
            entities: {
              create: newsArticle.entities?.map((entity) => ({
                name: entity.name,
                type: entity.type,
              })),
            },
          },
          include: {
            entities: true,
          },
        })

        savedArticles.push({
          ...saved,
          category: JSON.parse(saved.category),
          keywords: JSON.parse(saved.keywords),
        })
      }
    }

    return NextResponse.json({
      message: `Auto-fetched ${newsResponse.news.length} articles for ${symbol}, saved ${savedArticles.length} new articles`,
      cached: false,
      totalResults: newsResponse.available,
      savedCount: savedArticles.length,
    })
  } catch (error) {
    console.error('Error auto-fetching news:', error)
    return NextResponse.json(
      { error: 'Failed to auto-fetch news articles' },
      { status: 500 }
    )
  }
}
