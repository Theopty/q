const Database = require('better-sqlite3')
const db = new Database('./prisma/dev.db')

console.log('Creating database schema...\n')

try {
  // Create NewsArticle table
  db.exec(`
    CREATE TABLE IF NOT EXISTS NewsArticle (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      content TEXT,
      url TEXT NOT NULL,
      imageUrl TEXT,
      source TEXT NOT NULL,
      category TEXT NOT NULL,
      keywords TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'en',
      country TEXT,
      sentiment TEXT,
      publishedAt DATETIME NOT NULL,
      fetchedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
  console.log('✅ Created NewsArticle table')

  // Create indexes for NewsArticle
  db.exec(`
    CREATE INDEX IF NOT EXISTS NewsArticle_publishedAt_idx ON NewsArticle(publishedAt);
    CREATE INDEX IF NOT EXISTS NewsArticle_source_idx ON NewsArticle(source);
    CREATE INDEX IF NOT EXISTS NewsArticle_sentiment_idx ON NewsArticle(sentiment);
  `)
  console.log('✅ Created NewsArticle indexes')

  // Create NewsEntity table
  db.exec(`
    CREATE TABLE IF NOT EXISTS NewsEntity (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      articleId TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (articleId) REFERENCES NewsArticle(id) ON DELETE CASCADE
    );
  `)
  console.log('✅ Created NewsEntity table')

  // Create indexes for NewsEntity
  db.exec(`
    CREATE INDEX IF NOT EXISTS NewsEntity_name_idx ON NewsEntity(name);
    CREATE INDEX IF NOT EXISTS NewsEntity_type_idx ON NewsEntity(type);
  `)
  console.log('✅ Created NewsEntity indexes')

  // Create StockData table
  db.exec(`
    CREATE TABLE IF NOT EXISTS StockData (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      name TEXT,
      price REAL NOT NULL,
      open REAL,
      high REAL,
      low REAL,
      close REAL,
      volume INTEGER,
      change REAL,
      changePercent REAL,
      timestamp DATETIME NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
  console.log('✅ Created StockData table')

  // Create indexes and unique constraint for StockData
  db.exec(`
    CREATE INDEX IF NOT EXISTS StockData_symbol_idx ON StockData(symbol);
    CREATE INDEX IF NOT EXISTS StockData_timestamp_idx ON StockData(timestamp);
    CREATE UNIQUE INDEX IF NOT EXISTS StockData_symbol_timestamp_key ON StockData(symbol, timestamp);
  `)
  console.log('✅ Created StockData indexes')

  // Create WatchlistStock table
  db.exec(`
    CREATE TABLE IF NOT EXISTS WatchlistStock (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      addedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
  console.log('✅ Created WatchlistStock table')

  // Create NewsQuery table
  db.exec(`
    CREATE TABLE IF NOT EXISTS NewsQuery (
      id TEXT PRIMARY KEY,
      keyword TEXT NOT NULL,
      dateRanges TEXT NOT NULL,
      totalArticles INTEGER NOT NULL DEFAULT 0,
      lastFetchedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
  console.log('✅ Created NewsQuery table')

  // Create indexes for NewsQuery
  db.exec(`
    CREATE INDEX IF NOT EXISTS NewsQuery_keyword_idx ON NewsQuery(keyword);
    CREATE INDEX IF NOT EXISTS NewsQuery_lastFetchedAt_idx ON NewsQuery(lastFetchedAt);
  `)
  console.log('✅ Created NewsQuery indexes')

  console.log('\n✅ Database schema created successfully!')

  // Check if there's any data
  const articleCount = db.prepare('SELECT COUNT(*) as count FROM NewsArticle').get()
  const queryCount = db.prepare('SELECT COUNT(*) as count FROM NewsQuery').get()

  console.log(`\n📊 Current data:`)
  console.log(`   Articles: ${articleCount.count}`)
  console.log(`   Queries: ${queryCount.count}`)

} catch (error) {
  console.error('❌ Error creating schema:', error)
} finally {
  db.close()
}
