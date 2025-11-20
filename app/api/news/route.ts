import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchNews, convertToNewsArticle } from '@/lib/worldnews'

/**
 * GET /api/news - Fetch news articles from database using raw SQL
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

    // Build SQL query with filters
    let sql = 'SELECT * FROM NewsArticle WHERE 1=1'
    const params: any[] = []

    if (sources && sources.length > 0) {
      sql += ` AND source IN (${sources.map(() => '?').join(',')})`
      params.push(...sources)
    }

    if (sentiment) {
      sql += ' AND sentiment = ?'
      params.push(sentiment)
    }

    if (dateFrom) {
      sql += ' AND publishedAt >= ?'
      params.push(new Date(dateFrom).toISOString())
    }

    if (dateTo) {
      sql += ' AND publishedAt <= ?'
      params.push(new Date(dateTo).toISOString())
    }

    sql += ' ORDER BY publishedAt DESC LIMIT 500'

    // Use raw SQL query
    let articles = await prisma.$queryRawUnsafe<Array<{
      id: string
      title: string
      description: string | null
      content: string | null
      url: string
      imageUrl: string | null
      source: string
      category: string
      keywords: string
      language: string
      country: string | null
      sentiment: string | null
      publishedAt: Date
      fetchedAt: Date
      createdAt: Date
      updatedAt: Date
    }>>(sql, ...params)

    // Get entities for each article
    const articlesWithEntities = await Promise.all(
      articles.map(async (article) => {
        const entities = await prisma.$queryRawUnsafe<Array<{
          id: string
          name: string
          type: string
        }>>('SELECT id, name, type FROM NewsEntity WHERE articleId = ?', article.id)

        return {
          ...article,
          publishedAt: article.publishedAt.toISOString(),
          fetchedAt: article.fetchedAt.toISOString(),
          createdAt: article.createdAt.toISOString(),
          updatedAt: article.updatedAt.toISOString(),
          category: JSON.parse(article.category),
          keywords: JSON.parse(article.keywords),
          entities: entities || [],
        }
      })
    )

    // Filter by entity name if provided
    let filteredArticles = articlesWithEntities
    if (entity) {
      filteredArticles = filteredArticles.filter((article) =>
        article.entities.some((e) => e.name.toLowerCase().includes(entity.toLowerCase()))
      )
    }

    // Filter by keywords if provided
    if (keywords && keywords.length > 0) {
      filteredArticles = filteredArticles.filter((article) =>
        keywords.some((kw) => article.keywords.some((k: string) => k.toLowerCase().includes(kw.toLowerCase())))
      )
    }

    // Filter by categories if provided
    if (categories && categories.length > 0) {
      filteredArticles = filteredArticles.filter((article) =>
        categories.some((cat) => article.category.includes(cat))
      )
    }

    return NextResponse.json(filteredArticles.slice(0, 100))
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

    // Store articles in database using raw SQL
    const savedArticles = []

    for (const article of newsResponse.news) {
      const newsArticle = convertToNewsArticle(article)

      // Check if article already exists using raw SQL
      const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        'SELECT id FROM NewsArticle WHERE url = ? LIMIT 1',
        newsArticle.url
      )

      if (existing.length === 0) {
        try {
          const articleId = crypto.randomUUID()
          const now = new Date().toISOString()

          // Insert article using raw SQL
          await prisma.$executeRawUnsafe(`
            INSERT INTO NewsArticle (
              id, title, description, content, url, imageUrl, source,
              category, keywords, language, country, sentiment,
              publishedAt, fetchedAt, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
            articleId,
            newsArticle.title,
            newsArticle.description || null,
            newsArticle.content || null,
            newsArticle.url,
            newsArticle.imageUrl || null,
            newsArticle.source,
            JSON.stringify(newsArticle.category),
            JSON.stringify(newsArticle.keywords),
            newsArticle.language || 'en',
            newsArticle.country || null,
            newsArticle.sentiment || null,
            newsArticle.publishedAt.toISOString(),
            now,
            now,
            now
          )

          // Insert entities using raw SQL
          const entities = []
          if (newsArticle.entities && newsArticle.entities.length > 0) {
            for (const entity of newsArticle.entities) {
              const entityId = crypto.randomUUID()
              await prisma.$executeRawUnsafe(`
                INSERT INTO NewsEntity (id, name, type, articleId, createdAt)
                VALUES (?, ?, ?, ?, ?)
              `, entityId, entity.name, entity.type, articleId, now)

              entities.push({
                id: entityId,
                name: entity.name,
                type: entity.type,
              })
            }
          }

          savedArticles.push({
            id: articleId,
            ...newsArticle,
            publishedAt: newsArticle.publishedAt.toISOString(),
            fetchedAt: now,
            createdAt: now,
            updatedAt: now,
            entities,
          })

          console.log('✅ Saved article:', newsArticle.title)
        } catch (saveError) {
          console.error('Error saving article:', newsArticle.title, saveError)
        }
      } else {
        console.log('Article already exists:', newsArticle.title)
      }
    }

    console.log(`Saved ${savedArticles.length} new articles to database`)

    // Save query metadata to history using raw SQL
    if (query && from_date && to_date) {
      try {
        const existingQueries = await prisma.$queryRawUnsafe<Array<{
          id: string
          keyword: string
          dateRanges: string
          totalArticles: number
        }>>(`
          SELECT * FROM NewsQuery
          WHERE keyword = ?
          LIMIT 1
        `, query.toLowerCase())

        const existingQuery = existingQueries[0]

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

          await prisma.$executeRawUnsafe(`
            UPDATE NewsQuery
            SET dateRanges = ?,
                totalArticles = ?,
                lastFetchedAt = ?,
                updatedAt = ?
            WHERE id = ?
          `, JSON.stringify(updatedRanges), totalArticles, new Date().toISOString(), new Date().toISOString(), existingQuery.id)
        } else {
          const id = crypto.randomUUID()
          const now = new Date().toISOString()

          await prisma.$executeRawUnsafe(`
            INSERT INTO NewsQuery (id, keyword, dateRanges, totalArticles, lastFetchedAt, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, id, query.toLowerCase(), JSON.stringify([newDateRange]), savedArticles.length, now, now, now)
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
