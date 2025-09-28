import { searchHousingListings } from './src/services/housingSearch'

async function testHousingSearch() {
  console.log('Testing housing search functionality...')

  try {
    const result = await searchHousingListings({
      location: 'New York, NY',
      maxPrice: 3000,
      bedrooms: 2,
      maxResults: 10
    })

    console.log('Search result:', JSON.stringify(result, null, 2))

    if (result.error) {
      console.log('❌ Search failed with error:', result.error)
    } else {
      console.log(`✅ Search successful, found ${result.top_picks.length} listings`)
      result.top_picks.forEach((listing, index) => {
        console.log(`\n${index + 1}. ${listing.address}`)
        console.log(`   Price: ${listing.price}`)
        console.log(`   Bedrooms: ${listing.num_bedrooms}, Bathrooms: ${listing.num_bathrooms}`)
        console.log(`   URL: ${listing.zillow_url}`)
      })
    }
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testHousingSearch()