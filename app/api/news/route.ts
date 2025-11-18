import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchNews, convertToNewsArticle } from '@/lib/newsdata'

/**
 * GET /api/news - Fetch news articles from database
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const keywords = searchParams.get('keywords')?.split(',').filter(Boolean)
    const categories = searchParams.get('categories')?.split(',').filter(Boolean)
    const sources = searchParams.get('sources')?.split(',').filter(Boolean)
    const sentiment = searchParams.get('sentiment')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const entity = searchParams.get('entity')

    // Build where clause
    const where: any = {}

    if (sources && sources.length > 0) {
      where.source = {
        in: sources,
      }
    }

    if (sentiment) {
      where.sentiment = sentiment
    }

    if (dateFrom || dateTo) {
      where.publishedAt = {}
      if (dateFrom) where.publishedAt.gte = new Date(dateFrom)
      if (dateTo) where.publishedAt.lte = new Date(dateTo)
    }

    if (entity) {
      where.entities = {
        some: {
          name: {
            contains: entity,
            mode: 'insensitive',
          },
        },
      }
    }

    let articles = await prisma.newsArticle.findMany({
      where,
      include: {
        entities: true,
      },
      orderBy: {
        publishedAt: 'desc',
      },
      take: 500,
    })

    // Parse JSON fields and filter in memory
    articles = articles.map((article) => ({
      ...article,
      category: JSON.parse(article.category),
      keywords: JSON.parse(article.keywords),
    }))

    // Filter by keywords if provided
    if (keywords && keywords.length > 0) {
      articles = articles.filter((article) =>
        keywords.some((kw) => article.keywords.some((k: string) => k.toLowerCase().includes(kw.toLowerCase())))
      )
    }

    // Filter by categories if provided
    if (categories && categories.length > 0) {
      articles = articles.filter((article) =>
        categories.some((cat) => article.category.includes(cat))
      )
    }

    return NextResponse.json(articles.slice(0, 100))
  } catch (error) {
    console.error('Error fetching news:', error)
    return NextResponse.json(
      { error: 'Failed to fetch news articles' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/news - Fetch and store new articles from Newsdata.io
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, category, language, country, sentiment, from_date, to_date } = body

    // Fetch news from Newsdata.io
    const newsResponse = await fetchNews({
      q: query,
      category: category,
      language: language || 'en',
      country: country,
      sentiment: sentiment,
      from_date: from_date,
      to_date: to_date,
    })

    // Store articles in database
    const savedArticles = []

    for (const article of newsResponse.results) {
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
            keywords: JSON.stringify(newsArticle.keywords),
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

        // Parse JSON fields for response
        savedArticles.push({
          ...saved,
          category: JSON.parse(saved.category),
          keywords: JSON.parse(saved.keywords),
        })
      }
    }

    return NextResponse.json({
      message: `Fetched ${newsResponse.results.length} articles, saved ${savedArticles.length} new articles`,
      totalResults: newsResponse.totalResults,
      savedArticles,
    })
  } catch (error) {
    console.error('Error fetching and storing news:', error)
    return NextResponse.json(
      { error: 'Failed to fetch and store news articles' },
      { status: 500 }
    )
  }
}
