const Database = require('better-sqlite3')
const db = new Database('./prisma/dev.db')

try {
  // Get all articles
  const articles = db.prepare(`
    SELECT
      na.id,
      na.title,
      na.description,
      na.source,
      na.category,
      na.keywords,
      na.publishedAt
    FROM NewsArticle na
    ORDER BY na.publishedAt DESC
  `).all()

  console.log(`\n📊 Total articles in database: ${articles.length}\n`)

  // Parse JSON fields and get entities for each article
  const parsedArticles = articles.map(article => {
    const entities = db.prepare('SELECT name, type FROM NewsEntity WHERE articleId = ?').all(article.id)
    return {
      ...article,
      category: JSON.parse(article.category),
      keywords: JSON.parse(article.keywords),
      entities: entities,
    }
  })

  // Analyze Tesla articles with current filter
  const teslaKeywords = ['tsla', 'tesla', 'elon musk', 'musk']
  const teslaArticlesFiltered = parsedArticles.filter(article => {
    const titleAndEntities = `${article.title} ${article.entities.map(e => e.name).join(' ')}`.toLowerCase()
    return teslaKeywords.some(keyword => titleAndEntities.includes(keyword.toLowerCase()))
  })

  console.log(`🚗 Tesla articles found by CURRENT filter: ${teslaArticlesFiltered.length}\n`)

  // Find ALL articles that mention Tesla anywhere
  const allTeslaArticles = parsedArticles.filter(article => {
    const fullText = `${article.title} ${article.description || ''} ${article.entities.map(e => e.name).join(' ')} ${article.keywords.join(' ')}`.toLowerCase()
    return fullText.includes('tesla') || fullText.includes('tsla') || fullText.includes('elon') || fullText.includes('musk')
  })

  console.log(`🔍 Total articles mentioning Tesla ANYWHERE: ${allTeslaArticles.length}\n`)

  console.log('=' .repeat(80))
  console.log('ARTICLES MATCHED BY CURRENT FILTER:')
  console.log('=' .repeat(80))
  teslaArticlesFiltered.forEach((article, idx) => {
    console.log(`\n${idx + 1}. ${article.title}`)
    console.log(`   Entities: ${article.entities.map(e => e.name).join(', ') || 'None'}`)
    console.log(`   Keywords: ${article.keywords.slice(0, 5).join(', ')}`)
  })

  console.log('\n' + '=' .repeat(80))
  console.log('ARTICLES MISSED BY CURRENT FILTER:')
  console.log('=' .repeat(80))

  const missedArticles = allTeslaArticles.filter(article =>
    !teslaArticlesFiltered.find(t => t.id === article.id)
  )

  if (missedArticles.length === 0) {
    console.log('\n✅ No articles are being missed! All Tesla articles are being matched.')
  } else {
    missedArticles.forEach((article, idx) => {
      console.log(`\n❌ MISSED ${idx + 1}. ${article.title}`)
      console.log(`   Entities: ${article.entities.map(e => e.name).join(', ') || 'None'}`)
      console.log(`   Keywords: ${article.keywords.slice(0, 5).join(', ')}`)
      console.log(`   Description: ${(article.description || '').substring(0, 150)}...`)

      // Show why it was missed
      const titleAndEntities = `${article.title} ${article.entities.map(e => e.name).join(' ')}`.toLowerCase()
      console.log(`   Why missed: Title+Entities text = "${titleAndEntities.substring(0, 100)}..."`)
    })
  }

  console.log('\n' + '=' .repeat(80))
  console.log('SUMMARY:')
  console.log('=' .repeat(80))
  console.log(`Total articles in DB: ${articles.length}`)
  console.log(`Articles mentioning Tesla: ${allTeslaArticles.length}`)
  console.log(`Articles matched by current filter: ${teslaArticlesFiltered.length}`)
  console.log(`Articles missed by current filter: ${missedArticles.length}`)
  console.log('=' .repeat(80))

} catch (error) {
  console.error('Error analyzing articles:', error)
} finally {
  db.close()
}
