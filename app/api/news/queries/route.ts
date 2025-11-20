import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/news/queries - Get all news query history
 */
export async function GET(request: NextRequest) {
  try {
    const queries = await prisma.newsQuery.findMany({
      orderBy: {
        lastFetchedAt: 'desc',
      },
    })

    // Parse dateRanges JSON for each query
    const parsedQueries = queries.map(query => ({
      ...query,
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

    // Check if query exists for this keyword
    const existingQuery = await prisma.newsQuery.findFirst({
      where: {
        keyword: keyword.toLowerCase(),
      },
    })

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

      const updated = await prisma.newsQuery.update({
        where: { id: existingQuery.id },
        data: {
          dateRanges: JSON.stringify(updatedRanges),
          totalArticles,
          lastFetchedAt: new Date(),
        },
      })

      return NextResponse.json({
        ...updated,
        dateRanges: updatedRanges,
      })
    } else {
      // Create new query
      const created = await prisma.newsQuery.create({
        data: {
          keyword: keyword.toLowerCase(),
          dateRanges: JSON.stringify([newDateRange]),
          totalArticles: articleCount || 0,
        },
      })

      return NextResponse.json({
        ...created,
        dateRanges: [newDateRange],
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

    await prisma.newsQuery.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Query deleted successfully' })
  } catch (error) {
    console.error('Error deleting news query:', error)
    return NextResponse.json(
      { error: 'Failed to delete news query' },
      { status: 500 }
    )
  }
}
