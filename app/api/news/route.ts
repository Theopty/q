import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchNews, convertToNewsArticle } from '@/lib/worldnews'

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
 * POST /api/news - Fetch and store new articles from WorldNewsAPI
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, language, country, from_date, to_date } = body

    console.log('POST /api/news called with:', { query, language, country, from_date, to_date })

    // Fetch news from WorldNewsAPI
    const newsResponse = await fetchNews({
      text: query,
      language: language || 'en',
      source_countries: country || 'us',
      earliest_publish_date: from_date,
      latest_publish_date: to_date,
      number: 50,
    })

    console.log(`WorldNewsAPI returned ${newsResponse.news.length} articles (${newsResponse.available} available total)`)

    // Store articles in database
    const savedArticles = []

    for (const article of newsResponse.news) {
      const newsArticle = convertToNewsArticle(article)

      // Check if article already exists
      const existing = await prisma.newsArticle.findFirst({
        where: { url: newsArticle.url },
      })

      if (!existing) {
        try {
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
        } catch (saveError) {
          console.error('Error saving article:', newsArticle.title, saveError)
        }
      } else {
        console.log('Article already exists:', newsArticle.title)
      }
    }

    console.log(`Saved ${savedArticles.length} new articles to database`)

    // Save query metadata to history
    if (query && from_date && to_date) {
      try {
        const existingQuery = await prisma.newsQuery.findFirst({
          where: { keyword: query.toLowerCase() },
        })

        const newDateRange = {
          from: from_date,
          to: to_date,
          articleCount: savedArticles.length,
          fetchedAt: new Date().toISOString(),
        }

        if (existingQuery) {
          const existingRanges = JSON.parse(existingQuery.dateRanges)
          const rangeExists = existingRanges.some(
            (range: any) => range.from === from_date && range.to === to_date
          )

          let updatedRanges
          if (rangeExists) {
            updatedRanges = existingRanges.map((range: any) =>
              range.from === from_date && range.to === to_date
                ? { ...range, articleCount: range.articleCount + savedArticles.length, fetchedAt: newDateRange.fetchedAt }
                : range
            )
          } else {
            updatedRanges = [...existingRanges, newDateRange]
          }

          const totalArticles = updatedRanges.reduce(
            (sum: number, range: any) => sum + range.articleCount,
            0
          )

          await prisma.newsQuery.update({
            where: { id: existingQuery.id },
            data: {
              dateRanges: JSON.stringify(updatedRanges),
              totalArticles,
              lastFetchedAt: new Date(),
            },
          })
        } else {
          await prisma.newsQuery.create({
            data: {
              keyword: query.toLowerCase(),
              dateRanges: JSON.stringify([newDateRange]),
              totalArticles: savedArticles.length,
            },
          })
        }
      } catch (queryError) {
        console.error('Error saving query metadata:', queryError)
        // Don't fail the whole request if query metadata fails
      }
    }

    return NextResponse.json({
      message: `Fetched ${newsResponse.news.length} articles, saved ${savedArticles.length} new articles`,
      totalResults: newsResponse.available,
      savedArticles,
    })
  } catch (error: any) {
    console.error('Error fetching and storing news:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch and store news articles' },
      { status: 500 }
    )
  }
}
