import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchStockData, searchStocks } from '@/lib/stockmarket'

/**
 * GET /api/stocks - Get stock data from database or search stocks
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const symbol = searchParams.get('symbol')
    const search = searchParams.get('search')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    // If search query, search for stocks
    if (search) {
      const results = await searchStocks(search)
      return NextResponse.json(results)
    }

    // If no symbol, return watchlist
    if (!symbol) {
      const watchlist = await prisma.watchlistStock.findMany({
        orderBy: {
          addedAt: 'desc',
        },
      })
      return NextResponse.json(watchlist)
    }

    // Build where clause
    const where: any = {
      symbol: symbol.toUpperCase(),
    }

    if (dateFrom || dateTo) {
      where.timestamp = {}
      if (dateFrom) where.timestamp.gte = new Date(dateFrom)
      if (dateTo) where.timestamp.lte = new Date(dateTo)
    }

    const stockData = await prisma.stockData.findMany({
      where,
      orderBy: {
        timestamp: 'desc',
      },
      take: 1000,
    })

    return NextResponse.json(stockData)
  } catch (error) {
    console.error('Error fetching stock data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stock data' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/stocks - Fetch and store stock data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { symbol, from, to } = body

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      )
    }

    const fromDate = from ? new Date(from) : undefined
    const toDate = to ? new Date(to) : undefined

    // Fetch stock data from external API
    const stockData = await fetchStockData(symbol.toUpperCase(), fromDate, toDate)

    // Store in database
    const savedData = []

    for (const data of stockData) {
      // Check if data point already exists
      const existing = await prisma.stockData.findUnique({
        where: {
          symbol_timestamp: {
            symbol: data.symbol,
            timestamp: data.timestamp,
          },
        },
      })

      if (!existing) {
        const saved = await prisma.stockData.create({
          data: {
            symbol: data.symbol,
            name: data.name,
            price: data.price,
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
            volume: data.volume,
            change: data.change,
            changePercent: data.changePercent,
            timestamp: data.timestamp,
          },
        })

        savedData.push(saved)
      }
    }

    return NextResponse.json({
      message: `Fetched ${stockData.length} data points, saved ${savedData.length} new data points`,
      savedData,
    })
  } catch (error) {
    console.error('Error fetching and storing stock data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch and store stock data' },
      { status: 500 }
    )
  }
}
