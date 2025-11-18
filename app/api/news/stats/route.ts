import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/news/stats - Get news statistics
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const where: any = {}
    if (dateFrom || dateTo) {
      where.publishedAt = {}
      if (dateFrom) where.publishedAt.gte = new Date(dateFrom)
      if (dateTo) where.publishedAt.lte = new Date(dateTo)
    }

    // Get total count
    const totalCount = await prisma.newsArticle.count({ where })

    // Get sentiment distribution
    const sentimentStats = await prisma.newsArticle.groupBy({
      by: ['sentiment'],
      where,
      _count: true,
    })

    // Get top sources
    const sourceStats = await prisma.newsArticle.groupBy({
      by: ['source'],
      where,
      _count: true,
      orderBy: {
        _count: {
          source: 'desc',
        },
      },
      take: 10,
    })

    // Get top entities
    const entityStats = await prisma.newsEntity.groupBy({
      by: ['name', 'type'],
      where: dateFrom || dateTo ? {
        article: {
          publishedAt: where.publishedAt,
        },
      } : undefined,
      _count: true,
      orderBy: {
        _count: {
          name: 'desc',
        },
      },
      take: 20,
    })

    // Get category distribution
    const articles = await prisma.newsArticle.findMany({
      where,
      select: {
        category: true,
      },
    })

    const categoryMap = new Map<string, number>()
    articles.forEach((article) => {
      article.category.forEach((cat) => {
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1)
      })
    })

    const categoryStats = Array.from(categoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({
      totalCount,
      sentimentStats,
      sourceStats,
      entityStats,
      categoryStats,
    })
  } catch (error) {
    console.error('Error fetching news stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch news statistics' },
      { status: 500 }
    )
  }
}
