import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/news/queries - Get all news query history
 */
export async function GET(request: NextRequest) {
  try {
    // Use raw SQL since Prisma client may not have NewsQuery model yet
    const queries = await prisma.$queryRawUnsafe<Array<{
      id: string
      keyword: string
      dateRanges: string
      totalArticles: number
      lastFetchedAt: Date
      createdAt: Date
      updatedAt: Date
    }>>(`
      SELECT * FROM NewsQuery
      ORDER BY lastFetchedAt DESC
    `)

    // Parse dateRanges JSON for each query
    const parsedQueries = queries.map(query => ({
      ...query,
      lastFetchedAt: query.lastFetchedAt.toISOString(),
      createdAt: query.createdAt.toISOString(),
      updatedAt: query.updatedAt.toISOString(),
      dateRanges: JSON.parse(query.dateRanges),
    }))

    return NextResponse.json(parsedQueries)
  } catch (error) {
    console.error('Error fetching news queries:', error)
    return NextResponse.json(
      { error: 'Failed to fetch news queries' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/news/queries - Create or update a news query
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { keyword, from_date, to_date, articleCount } = body

    if (!keyword || !from_date || !to_date) {
      return NextResponse.json(
        { error: 'Keyword, from_date, and to_date are required' },
        { status: 400 }
      )
    }

    // Check if query exists for this keyword using raw SQL
    const existingQueries = await prisma.$queryRawUnsafe<Array<{
      id: string
      keyword: string
      dateRanges: string
      totalArticles: number
      lastFetchedAt: Date
    }>>(`
      SELECT * FROM NewsQuery
      WHERE keyword = ?
      LIMIT 1
    `, keyword.toLowerCase())

    const existingQuery = existingQueries[0]

    const newDateRange = {
      from: from_date,
      to: to_date,
      articleCount: articleCount || 0,
      fetchedAt: new Date().toISOString(),
    }

    if (existingQuery) {
      // Update existing query by adding new date range
      const existingRanges = JSON.parse(existingQuery.dateRanges)

      // Check if this exact date range already exists
      const rangeExists = existingRanges.some(
        (range: any) => range.from === from_date && range.to === to_date
      )

      let updatedRanges
      if (rangeExists) {
        // Update the existing range
        updatedRanges = existingRanges.map((range: any) =>
          range.from === from_date && range.to === to_date
            ? { ...range, articleCount: (range.articleCount || 0) + (articleCount || 0), fetchedAt: newDateRange.fetchedAt }
            : range
        )
      } else {
        // Add new range
        updatedRanges = [...existingRanges, newDateRange]
      }

      const totalArticles = updatedRanges.reduce(
        (sum: number, range: any) => sum + (range.articleCount || 0),
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

      return NextResponse.json({
        id: existingQuery.id,
        keyword: keyword.toLowerCase(),
        dateRanges: updatedRanges,
        totalArticles,
        lastFetchedAt: new Date().toISOString(),
      })
    } else {
      // Create new query
      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      await prisma.$executeRawUnsafe(`
        INSERT INTO NewsQuery (id, keyword, dateRanges, totalArticles, lastFetchedAt, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, id, keyword.toLowerCase(), JSON.stringify([newDateRange]), articleCount || 0, now, now, now)

      return NextResponse.json({
        id,
        keyword: keyword.toLowerCase(),
        dateRanges: [newDateRange],
        totalArticles: articleCount || 0,
        lastFetchedAt: now,
      })
    }
  } catch (error) {
    console.error('Error creating/updating news query:', error)
    return NextResponse.json(
      { error: 'Failed to create/update news query' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/news/queries - Delete a news query
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Query ID is required' },
        { status: 400 }
      )
    }

    await prisma.$executeRawUnsafe(`
      DELETE FROM NewsQuery
      WHERE id = ?
    `, id)

    return NextResponse.json({ message: 'Query deleted successfully' })
  } catch (error) {
    console.error('Error deleting news query:', error)
    return NextResponse.json(
      { error: 'Failed to delete news query' },
      { status: 500 }
    )
  }
}
