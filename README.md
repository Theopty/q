# News & Market Intelligence Dashboard

A comprehensive dashboard for fetching, analyzing, and correlating news sentiment with stock market data. Built with Next.js, TypeScript, Prisma, and multiple data visualization libraries.

## Features

### 📰 News Dashboard
- **Fetch News from WorldNewsAPI**: Real-time news fetching with built-in sentiment analysis
- **Advanced Filtering**:
  - Keywords and search queries
  - Auto-detected categories (business, technology, politics, etc.)
  - Major US news sources only (no local papers)
  - Sentiment analysis included (positive, negative, neutral) with -1 to 1 scoring
  - Entity recognition (organizations, people, locations)
  - Date range filtering
- **Comprehensive Data Storage**: All news articles saved with timestamps for historical analysis
- **Rich Metadata**: Track categories, entities, and sentiment for each article

### 📈 Stock Market Dashboard
- **Multi-source Stock Data**: Integrated with Alpha Vantage and Financial Modeling Prep APIs
- **Stock Watchlist**: Add and track multiple stocks
- **Historical Data**: View price history with interactive charts
- **Real-time Metrics**: Track price, change, volume, high/low
- **Date Range Analysis**: Filter data by custom date ranges
- **Automatic Data Persistence**: All stock data saved to database

### 🔍 Correlation Analysis
- **Pattern Detection**: Visualize relationships between news and stock prices
- **Dual-axis Charts**: Compare stock price movements with news volume
- **Sentiment Correlation**: Analyze how positive/negative news affects stock prices
- **Statistical Analysis**: Calculate Pearson correlation coefficients
- **Visual Insights**: Interactive charts with multiple data layers
- **Historical Mapping**: Track patterns over custom date ranges

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Prisma ORM with SQLite (easily configurable to PostgreSQL/MySQL)
- **Data Visualization**: Recharts
- **APIs**:
  - WorldNewsAPI (news data with sentiment analysis)
  - Alpha Vantage (stock market data)
  - Financial Modeling Prep (alternative stock data)

## Prerequisites

- Node.js 18+ and npm
- API Keys:
  - [WorldNewsAPI Key](https://worldnewsapi.com/) (Free tier: 100 requests/day with sentiment analysis included)
  - [Alpha Vantage API Key](https://www.alphavantage.co/support/#api-key) OR
  - [Financial Modeling Prep API Key](https://financialmodelingprep.com/developer/docs/)

## Installation

1. **Clone the repository**:
```bash
git clone <repository-url>
cd q
```

2. **Install dependencies**:
```bash
npm install
```

3. **Set up environment variables**:
```bash
cp .env.example .env
```

Edit `.env` and add your API keys:
```env
WORLDNEWS_API_KEY=your_worldnews_api_key_here
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_api_key_here
# OR
FMP_API_KEY=your_fmp_api_key_here

DATABASE_URL="file:./prisma/dev.db"
```

4. **Set up the database**:
```bash
npx prisma generate
npx prisma db push
```

5. **Run the development server**:
```bash
npm run dev
```

6. **Open your browser**:
Navigate to [http://localhost:3000](http://localhost:3000)

## Usage Guide

### 1. News Dashboard

#### Fetching News
1. Enter keywords in the search box (e.g., "Apple", "Tesla", "Bitcoin")
2. Click "Fetch Top News" to retrieve articles from WorldNewsAPI
3. Articles are automatically saved to your database with timestamps and sentiment scores

#### Filtering News
1. Click the "Filters" button
2. Select categories, sentiment, date ranges, or entity names
3. Click "Apply Filters" to update the view
4. Click "Refresh" to reload from database

#### Understanding the Data
- **Sentiment Badges**: Color-coded sentiment indicators (green = positive, red = negative, gray = neutral)
- **Categories**: Topic tags (business, technology, sports, etc.)
- **Keywords**: Extracted keywords from articles
- **Entities**: Recognized organizations, people, and locations

### 2. Stock Market Dashboard

#### Adding Stocks to Watchlist
1. Enter a stock symbol in the search box (e.g., "AAPL", "TSLA", "MSFT")
2. Click "Search"
3. Select from results and click "Add" to add to watchlist

#### Viewing Stock Data
1. Click on any stock in your watchlist
2. Click "Fetch Latest Data" to retrieve historical data from the API
3. Use date filters to analyze specific time periods
4. View price charts with volume overlay

### 3. Correlation Analysis

#### Analyzing News-Market Relationships
1. Enter a stock symbol (e.g., "AAPL")
2. Optionally add keywords to filter relevant news (e.g., "Apple, iPhone")
3. Select a date range (default: last 30 days)
4. Click "Analyze Correlation"

#### Understanding the Results
- **News Volume Correlation**: Shows if more news articles correlate with stock price changes
  - Values close to +1: Strong positive correlation
  - Values close to -1: Strong negative correlation
  - Values close to 0: Weak or no correlation
- **Sentiment Correlation**: Shows if positive/negative news sentiment affects stock prices
- **Visual Charts**:
  - Stock Price vs News Volume (bar + line chart)
  - Stock Price vs Sentiment Breakdown (stacked bar + line chart)

#### Pattern Investigation
- Look for spikes in news volume before major price movements
- Identify if positive sentiment precedes price increases
- Compare multiple time periods to validate patterns
- Note: Correlation ≠ Causation (use as one factor among many)

## Database Schema

### NewsArticle
- Stores complete article data with metadata
- Indexes on publishedAt, source, and sentiment for fast queries
- Related entities tracked separately

### NewsEntity
- Extracted entities (people, organizations, locations)
- Linked to articles for advanced filtering

### StockData
- Historical stock prices with OHLCV data
- Timestamps for precise time-series analysis
- Unique constraint on (symbol, timestamp)

### WatchlistStock
- User's tracked stocks
- Quick access to frequently monitored symbols

## API Endpoints

### News APIs
- `GET /api/news` - Fetch news articles from database
- `POST /api/news` - Fetch new articles from WorldNewsAPI with sentiment analysis
- `GET /api/news/stats` - Get news statistics and aggregations

### Stock APIs
- `GET /api/stocks` - Get stock data from database
- `POST /api/stocks` - Fetch new stock data from external APIs
- `GET /api/stocks/watchlist` - Get watchlist
- `POST /api/stocks/watchlist` - Add to watchlist
- `DELETE /api/stocks/watchlist` - Remove from watchlist

### Correlation API
- `GET /api/correlation` - Get correlation data between news and stocks

## Configuration

### Using PostgreSQL Instead of SQLite
Edit `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Update your `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/newsmarket"
```

Run migrations:
```bash
npx prisma db push
```

### Customizing News Categories
Edit `lib/worldnews.ts` to add/remove categories:
```typescript
export const NEWS_CATEGORIES = [
  'business',
  'technology',
  // Add your categories
]
```

## Troubleshooting

### API Rate Limits
- **WorldNewsAPI Free**: 100 requests/day (includes sentiment analysis)
- **Alpha Vantage Free**: 25 requests/day, 5 per minute
- **FMP Free**: 250 requests/day

**Solution**: Use both FMP and Alpha Vantage for better stock coverage. WorldNewsAPI free tier includes all sentiment features.

### No Data Showing
1. Check that you've clicked "Fetch News" or "Fetch Latest Data"
2. Verify API keys are correct in `.env`
3. Check browser console for error messages
4. Ensure date ranges have data available

### Correlation Shows "No Data"
1. Make sure you have both news AND stock data for the selected date range
2. Fetch news with relevant keywords first
3. Fetch stock data for the same time period
4. Try expanding the date range

### Database Errors
```bash
# Reset database
rm prisma/dev.db
npx prisma db push
```

## Production Deployment

### Vercel (Recommended)
1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. For production database, use PostgreSQL (see Configuration section)

### Docker
```bash
# Build
docker build -t news-market-dashboard .

# Run
docker run -p 3000:3000 --env-file .env news-market-dashboard
```

## Future Enhancements

- [ ] User authentication and personalized watchlists
- [ ] Email alerts for correlation patterns
- [ ] Export data to CSV/Excel
- [ ] More sophisticated NLP for entity extraction
- [ ] Machine learning models for prediction
- [ ] Social media sentiment integration (Twitter/Reddit)
- [ ] Webhook support for real-time updates
- [ ] Mobile responsive improvements
- [ ] Dark mode toggle

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Support

For issues or questions:
- Open an issue on GitHub
- Check API documentation:
  - [WorldNewsAPI Docs](https://worldnewsapi.com/docs/)
  - [Alpha Vantage Docs](https://www.alphavantage.co/documentation/)
  - [FMP Docs](https://financialmodelingprep.com/developer/docs/)

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- News data with sentiment analysis from [WorldNewsAPI](https://worldnewsapi.com/)
- Stock data from [Alpha Vantage](https://www.alphavantage.co/) and [Financial Modeling Prep](https://financialmodelingprep.com/)
- Charts powered by [Recharts](https://recharts.org/)
