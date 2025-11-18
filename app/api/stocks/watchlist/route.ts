import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/stocks/watchlist - Get watchlist
 */
export async function GET() {
  try {
    const watchlist = await prisma.watchlistStock.findMany({
      orderBy: {
        addedAt: 'desc',
      },
    })

    return NextResponse.json(watchlist)
  } catch (error) {
    console.error('Error fetching watchlist:', error)
    return NextResponse.json(
      { error: 'Failed to fetch watchlist' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/stocks/watchlist - Add stock to watchlist
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { symbol, name } = body

    if (!symbol || !name) {
      return NextResponse.json(
        { error: 'Symbol and name are required' },
        { status: 400 }
      )
    }

    const stock = await prisma.watchlistStock.create({
      data: {
        symbol: symbol.toUpperCase(),
        name,
      },
    })

    return NextResponse.json(stock)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Stock already in watchlist' },
        { status: 409 }
      )
    }
    console.error('Error adding to watchlist:', error)
    return NextResponse.json(
      { error: 'Failed to add stock to watchlist' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/stocks/watchlist - Remove stock from watchlist
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    await prisma.watchlistStock.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Stock removed from watchlist' })
  } catch (error) {
    console.error('Error removing from watchlist:', error)
    return NextResponse.json(
      { error: 'Failed to remove stock from watchlist' },
      { status: 500 }
    )
  }
}
