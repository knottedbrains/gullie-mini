// Test query customization logic
function getCountryFromCity(city) {
  const cityCountryMap = {
    'paris': 'France',
    'london': 'UK',
    'berlin': 'Germany',
    'san francisco': 'US',
    'new york': 'US',
  }
  return cityCountryMap[city.toLowerCase().trim()] || city
}

function customizeQueryForLocation(query, relocationProfile) {
  if (!query || (!relocationProfile.fromCity && !relocationProfile.toCity)) {
    return query
  }

  let customizedQuery = query

  // Replace hardcoded Berlin references with destination city
  if (relocationProfile.toCity) {
    customizedQuery = customizedQuery.replace(/\bBerlin\b/gi, relocationProfile.toCity)
  }

  // Replace hardcoded Germany references with destination country
  if (relocationProfile.toCity) {
    const destinationCountry = getCountryFromCity(relocationProfile.toCity)
    customizedQuery = customizedQuery.replace(/\bGermany\b/gi, destinationCountry)
    customizedQuery = customizedQuery.replace(/\bGerman\b/gi, destinationCountry)
  }

  // For visa/immigration queries, customize based on origin and destination
  if (customizedQuery.toLowerCase().includes('visa') || customizedQuery.toLowerCase().includes('immigration')) {
    const fromCountry = relocationProfile.fromCity ? getCountryFromCity(relocationProfile.fromCity) : 'US'
    const toCountry = relocationProfile.toCity ? getCountryFromCity(relocationProfile.toCity) : 'US'

    // Replace generic visa patterns with specific routing
    if (relocationProfile.fromCity && relocationProfile.toCity) {
      customizedQuery = customizedQuery.replace(
        /visa.*requirements.*for.*citizens/gi,
        `visa requirements for ${fromCountry} citizens`
      )
      // Handle biometrics appointment references
      if (customizedQuery.toLowerCase().includes('biometrics appointment')) {
        customizedQuery = customizedQuery.replace(
          /.*biometrics appointment.*/gi,
          `How to prepare for ${toCountry} visa biometrics appointment in ${relocationProfile.fromCity} 2025`
        )
      }
    }
  }

  return customizedQuery
}

// Test scenarios
console.log('🧪 Testing Query Customization\n')

const parisToSF = {
  fromCity: 'Paris',
  toCity: 'San Francisco'
}

const testQueries = [
  'Current rental market insights for family-friendly neighborhoods in Berlin',
  'Latest Germany work visa documentation requirements for US citizens 2025',
  'How to prepare for Germany visa biometrics appointment 2025',
  'Best virtual apartment tour tools for Berlin relocation 2025',
  'Family-friendly neighborhoods in Berlin with international schools'
]

console.log('📍 Relocation Profile: Paris → San Francisco\n')

testQueries.forEach((query, index) => {
  const customized = customizeQueryForLocation(query, parisToSF)
  console.log(`${index + 1}. Original:`)
  console.log(`   "${query}"`)
  console.log(`   Customized:`)
  console.log(`   "${customized}"`)
  console.log('')
})

// Test another scenario
const berlinToNY = {
  fromCity: 'Berlin',
  toCity: 'New York'
}

console.log('📍 Relocation Profile: Berlin → New York\n')

testQueries.forEach((query, index) => {
  const customized = customizeQueryForLocation(query, berlinToNY)
  console.log(`${index + 1}. Customized for Berlin → NY:`)
  console.log(`   "${customized}"`)
  console.log('')
})