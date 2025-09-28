// Test the complete query building logic with no duplicates
function getCountryFromCity(city) {
  const cityCountryMap = {
    'paris': 'France',
    'san francisco': 'US',
    'new york': 'US',
    'berlin': 'Germany',
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

function isLocationAlreadyInQuery(query, relocationProfile) {
  const queryLower = query.toLowerCase()

  // Check if query contains country names (more reliable than city names for visa queries)
  if (relocationProfile.fromCity) {
    const fromCountry = getCountryFromCity(relocationProfile.fromCity).toLowerCase()
    if (queryLower.includes(fromCountry)) {
      return true
    }
  }

  if (relocationProfile.toCity) {
    const toCountry = getCountryFromCity(relocationProfile.toCity).toLowerCase()
    if (queryLower.includes(toCountry)) {
      return true
    }
  }

  // Check if query contains city names
  if (relocationProfile.fromCity && queryLower.includes(relocationProfile.fromCity.toLowerCase())) {
    return true
  }

  if (relocationProfile.toCity && queryLower.includes(relocationProfile.toCity.toLowerCase())) {
    return true
  }

  // Check for visa-related patterns that indicate location context is already present
  if (queryLower.includes('visa') || queryLower.includes('biometrics')) {
    return true // Don't add extra location info to visa queries that are already customized
  }

  return false
}

function buildSuggestedQuery(action, task, serviceLabel, relocationProfile) {
  const pieces = []

  if (action.defaultQuery?.trim()) {
    // Customize the default query based on relocation profile
    const customizedQuery = customizeQueryForLocation(action.defaultQuery.trim(), relocationProfile)
    pieces.push(customizedQuery)

    // For customized queries, don't add extra location info
    if (isLocationAlreadyInQuery(customizedQuery, relocationProfile)) {
      // Only add timeframe if present
      if (task.timeframe?.trim()) {
        pieces.push(`timeline ${task.timeframe.trim()}`)
      }

      return pieces.join(' ').replace(/\s+/g, ' ').trim()
    }
  } else {
    pieces.push(`${task.title} ${serviceLabel.toLowerCase()}`)
  }

  // For non-customized queries or queries without location context, add location info
  if (task.timeframe?.trim()) {
    pieces.push(`timeline ${task.timeframe.trim()}`)
  }

  if (relocationProfile.toCity) {
    pieces.push(`in ${relocationProfile.toCity}`)
  }
  if (relocationProfile.fromCity) {
    pieces.push(`from ${relocationProfile.fromCity}`)
  }

  return pieces.join(' ').replace(/\s+/g, ' ').trim()
}

// Test scenarios
console.log('🧪 Testing Complete Query Building (No Duplicates)\n')

const parisToSF = {
  fromCity: 'Paris',
  toCity: 'San Francisco'
}

const testCases = [
  {
    action: { defaultQuery: 'Latest Germany work visa documentation requirements for US citizens 2025' },
    task: { timeframe: 'Week 1', title: 'Collect immigration packet' },
    serviceLabel: 'Immigration'
  },
  {
    action: { defaultQuery: 'How to prepare for Germany visa biometrics appointment 2025' },
    task: { timeframe: 'Week 1', title: 'Biometrics appointment prep' },
    serviceLabel: 'Immigration'
  },
  {
    action: { defaultQuery: 'Current rental market insights for family-friendly neighborhoods in Berlin' },
    task: { timeframe: 'Day 3', title: 'Housing search' },
    serviceLabel: 'Housing'
  }
]

console.log('📍 Relocation Profile: Paris → San Francisco\n')

testCases.forEach((testCase, index) => {
  const result = buildSuggestedQuery(testCase.action, testCase.task, testCase.serviceLabel, parisToSF)
  console.log(`${index + 1}. ${testCase.task.title}`)
  console.log(`   Original: "${testCase.action.defaultQuery}"`)
  console.log(`   Final Query: "${result}"`)
  console.log('')
})