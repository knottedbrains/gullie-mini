// Quick test to verify housing search integration
import { initialTasks } from './src/data/tasks.js'

console.log('🔍 Checking housing tasks configuration...\n')

// Find housing tasks
const housingTasks = initialTasks.filter(task => task.serviceId === 'housing')

console.log(`Found ${housingTasks.length} housing task(s):`)

housingTasks.forEach((task, index) => {
  console.log(`\n${index + 1}. Task: ${task.title}`)
  console.log(`   ID: ${task.id}`)
  console.log(`   Description: ${task.description}`)
  console.log(`   Actions: ${task.actions?.length || 0}`)

  task.actions?.forEach((action, actionIndex) => {
    console.log(`   Action ${actionIndex + 1}: ${action.type} - ${action.label}`)
    if (action.type === 'housing_search') {
      console.log('   ✅ Housing search action found!')
      console.log(`   Instructions: ${action.instructions}`)
    }
  })
})

// Test API connection
console.log('\n🌐 Testing API connection...')

try {
  const response = await fetch('http://localhost:4000/api/housing/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'Brooklyn, NY',
      maxPrice: 2500,
      bedrooms: 1
    })
  })

  if (response.ok) {
    const data = await response.json()
    console.log('✅ API is working!')
    console.log(`Got ${data.top_picks?.length || 0} listings`)
    if (data.top_picks?.[0]) {
      console.log(`First listing: ${data.top_picks[0].price} at ${data.top_picks[0].address}`)
    }
  } else {
    console.log('❌ API error:', response.status)
  }
} catch (error) {
  console.log('❌ API connection failed:', error.message)
}

console.log('\n✅ Housing search integration test complete!')