-- Create NewsQuery table
CREATE TABLE IF NOT EXISTS NewsQuery (
  id TEXT PRIMARY KEY,
  keyword TEXT NOT NULL,
  dateRanges TEXT NOT NULL,
  totalArticles INTEGER DEFAULT 0,
  lastFetchedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS NewsQuery_keyword_idx ON NewsQuery(keyword);
CREATE INDEX IF NOT EXISTS NewsQuery_lastFetchedAt_idx ON NewsQuery(lastFetchedAt);
