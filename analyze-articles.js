const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function analyzeArticles() {
  try {
    // Get all articles
    const articles = await prisma.newsArticle.findMany({
      include: {
        entities: true,
      },
      orderBy: {
        publishedAt: 'desc',
      },
    })

    console.log(`\n📊 Total articles in database: ${articles.length}\n`)

    // Parse JSON fields
    const parsedArticles = articles.map(article => ({
      ...article,
      category: JSON.parse(article.category),
      keywords: JSON.parse(article.keywords),
    }))

    // Analyze Tesla articles
    const teslaKeywords = ['tsla', 'tesla', 'elon musk', 'musk']
    const teslaArticles = parsedArticles.filter(article => {
      const titleAndEntities = `${article.title} ${article.entities.map(e => e.name).join(' ')}`.toLowerCase()
      return teslaKeywords.some(keyword => titleAndEntities.includes(keyword.toLowerCase()))
    })

    console.log(`🚗 Tesla-related articles found: ${teslaArticles.length}\n`)

    console.log('Tesla articles:\n')
    teslaArticles.forEach((article, idx) => {
      console.log(`${idx + 1}. ${article.title}`)
      console.log(`   Entities: ${article.entities.map(e => e.name).join(', ')}`)
      console.log(`   Keywords: ${article.keywords.join(', ')}`)
      console.log(`   Source: ${article.source}`)
      console.log(`   Date: ${article.publishedAt}`)
      console.log('')
    })

    // Check other articles that might be missing
    console.log('\n🔍 Checking all articles for potential Tesla mentions:\n')
    parsedArticles.forEach((article, idx) => {
      const fullText = `${article.title} ${article.description || ''} ${article.entities.map(e => e.name).join(' ')} ${article.keywords.join(' ')}`.toLowerCase()
      if (fullText.includes('tesla') || fullText.includes('tsla') || fullText.includes('musk')) {
        const matched = teslaKeywords.some(keyword =>
          `${article.title} ${article.entities.map(e => e.name).join(' ')}`.toLowerCase().includes(keyword.toLowerCase())
        )
        if (!matched) {
          console.log(`❌ MISSED: ${article.title}`)
          console.log(`   Entities: ${article.entities.map(e => e.name).join(', ')}`)
          console.log(`   Keywords: ${article.keywords.join(', ')}`)
          console.log(`   Description snippet: ${(article.description || '').substring(0, 100)}...`)
          console.log('')
        }
      }
    })

  } catch (error) {
    console.error('Error analyzing articles:', error)
  } finally {
    await prisma.$disconnect()
  }
}

analyzeArticles()
