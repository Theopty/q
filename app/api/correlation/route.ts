import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CorrelationDataPoint } from '@/lib/types'

/**
 * GET /api/correlation - Get correlation data between news and stock market
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const symbol = searchParams.get('symbol')
    const keywords = searchParams.get('keywords')?.split(',').filter(Boolean)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      )
    }

    const fromDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const toDate = dateTo ? new Date(dateTo) : new Date()

    // Fetch stock data
    const stockData = await prisma.stockData.findMany({
      where: {
        symbol: symbol.toUpperCase(),
        timestamp: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    })

    // Fetch news data
    const newsWhere: any = {
      publishedAt: {
        gte: fromDate,
        lte: toDate,
      },
    }

    if (keywords && keywords.length > 0) {
      newsWhere.keywords = {
        hasSome: keywords,
      }
    }

    const newsData = await prisma.newsArticle.findMany({
      where: newsWhere,
      orderBy: {
        publishedAt: 'asc',
      },
    })

    // Group data by date
    const correlationMap = new Map<string, CorrelationDataPoint>()

    // Add stock data
    stockData.forEach((stock) => {
      const dateKey = stock.timestamp.toISOString().split('T')[0]
      if (!correlationMap.has(dateKey)) {
        correlationMap.set(dateKey, {
          date: new Date(dateKey),
          stockPrice: stock.close || stock.price,
          newsCount: 0,
          positiveSentiment: 0,
          negativeSentiment: 0,
          neutralSentiment: 0,
        })
      } else {
        const existing = correlationMap.get(dateKey)!
        existing.stockPrice = stock.close || stock.price
      }
    })

    // Add news data
    newsData.forEach((article) => {
      const dateKey = article.publishedAt.toISOString().split('T')[0]
      if (!correlationMap.has(dateKey)) {
        correlationMap.set(dateKey, {
          date: new Date(dateKey),
          stockPrice: 0,
          newsCount: 0,
          positiveSentiment: 0,
          negativeSentiment: 0,
          neutralSentiment: 0,
        })
      }

      const dataPoint = correlationMap.get(dateKey)!
      dataPoint.newsCount++

      if (article.sentiment === 'positive') {
        dataPoint.positiveSentiment++
      } else if (article.sentiment === 'negative') {
        dataPoint.negativeSentiment++
      } else {
        dataPoint.neutralSentiment++
      }
    })

    // Convert to array and sort
    const correlationData = Array.from(correlationMap.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    return NextResponse.json(correlationData)
  } catch (error) {
    console.error('Error fetching correlation data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch correlation data' },
      { status: 500 }
    )
  }
}
