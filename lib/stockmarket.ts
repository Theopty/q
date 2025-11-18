import axios from 'axios'
import { StockDataPoint } from './types'

/**
 * Fetch stock data using Alpha Vantage API
 */
export async function fetchStockDataAlphaVantage(
  symbol: string,
  interval: 'daily' | 'intraday' = 'daily'
): Promise<StockDataPoint[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY

  if (!apiKey) {
    throw new Error('ALPHA_VANTAGE_API_KEY is not configured')
  }

  try {
    const functionType = interval === 'daily' ? 'TIME_SERIES_DAILY' : 'TIME_SERIES_INTRADAY'
    const params: any = {
      function: functionType,
      symbol: symbol,
      apikey: apiKey,
      outputsize: 'full',
    }

    if (interval === 'intraday') {
      params.interval = '60min'
    }

    const response = await axios.get('https://www.alphavantage.co/query', { params })

    const timeSeriesKey = interval === 'daily'
      ? 'Time Series (Daily)'
      : 'Time Series (60min)'

    const timeSeries = response.data[timeSeriesKey]

    if (!timeSeries) {
      throw new Error('Invalid response from Alpha Vantage')
    }

    const stockData: StockDataPoint[] = []

    for (const [date, values] of Object.entries(timeSeries)) {
      const data: any = values
      const open = parseFloat(data['1. open'])
      const close = parseFloat(data['4. close'])

      stockData.push({
        symbol: symbol.toUpperCase(),
        price: close,
        open: open,
        high: parseFloat(data['2. high']),
        low: parseFloat(data['3. low']),
        close: close,
        volume: BigInt(data['5. volume']),
        change: close - open,
        changePercent: ((close - open) / open) * 100,
        timestamp: new Date(date),
      })
    }

    return stockData.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  } catch (error) {
    console.error('Error fetching stock data from Alpha Vantage:', error)
    throw error
  }
}

/**
 * Fetch stock data using Financial Modeling Prep API (alternative)
 */
export async function fetchStockDataFMP(
  symbol: string,
  from?: Date,
  to?: Date
): Promise<StockDataPoint[]> {
  const apiKey = process.env.FMP_API_KEY

  if (!apiKey) {
    throw new Error('FMP_API_KEY is not configured')
  }

  try {
    const fromDate = from?.toISOString().split('T')[0]
    const toDate = to?.toISOString().split('T')[0]

    const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}`
    const params: any = {
      apikey: apiKey,
    }

    if (fromDate) params.from = fromDate
    if (toDate) params.to = toDate

    const response = await axios.get(url, { params })

    const historical = response.data.historical

    if (!historical || !Array.isArray(historical)) {
      throw new Error('Invalid response from FMP')
    }

    const stockData: StockDataPoint[] = historical.map((item: any) => {
      const change = item.close - item.open
      return {
        symbol: symbol.toUpperCase(),
        price: item.close,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: BigInt(item.volume),
        change: change,
        changePercent: (change / item.open) * 100,
        timestamp: new Date(item.date),
      }
    })

    return stockData.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  } catch (error) {
    console.error('Error fetching stock data from FMP:', error)
    throw error
  }
}

/**
 * Main function to fetch stock data (tries both APIs)
 */
export async function fetchStockData(
  symbol: string,
  from?: Date,
  to?: Date
): Promise<StockDataPoint[]> {
  // Try FMP first (better for historical data with date ranges)
  if (process.env.FMP_API_KEY) {
    try {
      return await fetchStockDataFMP(symbol, from, to)
    } catch (error) {
      console.log('FMP failed, trying Alpha Vantage...')
    }
  }

  // Fallback to Alpha Vantage
  if (process.env.ALPHA_VANTAGE_API_KEY) {
    return await fetchStockDataAlphaVantage(symbol)
  }

  throw new Error('No stock market API key configured')
}

/**
 * Search for stock symbols
 */
export async function searchStocks(query: string): Promise<Array<{ symbol: string; name: string }>> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY || process.env.FMP_API_KEY

  if (!apiKey) {
    throw new Error('No stock market API key configured')
  }

  try {
    if (process.env.ALPHA_VANTAGE_API_KEY) {
      const response = await axios.get('https://www.alphavantage.co/query', {
        params: {
          function: 'SYMBOL_SEARCH',
          keywords: query,
          apikey: process.env.ALPHA_VANTAGE_API_KEY,
        },
      })

      const matches = response.data.bestMatches || []
      return matches.map((match: any) => ({
        symbol: match['1. symbol'],
        name: match['2. name'],
      }))
    } else if (process.env.FMP_API_KEY) {
      const response = await axios.get('https://financialmodelingprep.com/api/v3/search', {
        params: {
          query: query,
          apikey: process.env.FMP_API_KEY,
          limit: 10,
        },
      })

      return response.data.map((item: any) => ({
        symbol: item.symbol,
        name: item.name,
      }))
    }

    return []
  } catch (error) {
    console.error('Error searching stocks:', error)
    throw error
  }
}
