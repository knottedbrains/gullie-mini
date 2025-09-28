import { ApifyClient } from 'apify-client'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

const backendEnvPath = path.resolve(__dirname, '../../.env')
const projectRootEnvPath = path.resolve(__dirname, '../../../.env')

if (fs.existsSync(projectRootEnvPath)) {
  dotenv.config({ path: projectRootEnvPath })
}
if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath })
}

export interface HousingSearchParams {
  location: string
  minPrice?: number
  maxPrice?: number
  bedrooms?: number
  bathrooms?: number
  propertyType?: 'apartment' | 'house' | 'condo' | 'townhouse'
  maxResults?: number
}

export interface HousingListing {
  price: string
  address: string
  num_bedrooms: number
  num_bathrooms: number
  description: string
  image_url: string
  zillow_url: string
}

export interface HousingSearchResult {
  top_picks: HousingListing[]
  error?: string
}

function getApifyClient(): ApifyClient {
  const apiToken = process.env.APIFY_API_TOKEN
  if (!apiToken) {
    throw new Error('APIFY_API_TOKEN not set. Add it to your environment variables before running housing search.')
  }
  return new ApifyClient({ token: apiToken })
}

function formatPrice(price: number | string): string {
  if (typeof price === 'string') {
    return price.includes('$') ? price : `$${price}/mo`
  }
  return `$${price.toLocaleString()}/mo`
}

function extractImageUrl(images: any[]): string {
  if (!Array.isArray(images) || images.length === 0) {
    return 'https://via.placeholder.com/400x300?text=No+Image'
  }

  const firstImage = images[0]
  if (typeof firstImage === 'string') {
    return firstImage
  }

  if (firstImage && typeof firstImage === 'object') {
    return firstImage.url || firstImage.src || firstImage.href || 'https://via.placeholder.com/400x300?text=No+Image'
  }

  return 'https://via.placeholder.com/400x300?text=No+Image'
}

function generateZillowSearchUrl(address: string, zipCode: string): string {
  // Create a Zillow search URL based on address and location
  // This is a fallback if the API doesn't provide direct listing URLs
  const cleanAddress = address.replace(/[^\w\s]/g, '').replace(/\s+/g, '-').toLowerCase()
  const searchQuery = encodeURIComponent(`${address} ${zipCode}`)
  return `https://www.zillow.com/homes/${searchQuery}_rb/`
}

function scoreProperty(property: any, params: HousingSearchParams): number {
  let score = 0

  // Base score
  score += 50

  // Price scoring (if within range, higher score)
  const price = typeof property.price === 'number' ? property.price :
                 parseInt(property.price?.toString().replace(/[^0-9]/g, '') || '0')

  if (params.maxPrice && price <= params.maxPrice) {
    score += 30
  }
  if (params.minPrice && price >= params.minPrice) {
    score += 20
  }

  // Bedroom/bathroom match
  if (params.bedrooms && property.bedrooms === params.bedrooms) {
    score += 25
  }
  if (params.bathrooms && property.bathrooms === params.bathrooms) {
    score += 25
  }

  // Property type match
  if (params.propertyType && property.propertyType?.toLowerCase().includes(params.propertyType.toLowerCase())) {
    score += 15
  }

  // Image availability
  if (property.images && Array.isArray(property.images) && property.images.length > 0) {
    score += 10
  }

  // Description quality (longer descriptions get higher score)
  if (property.description && property.description.length > 100) {
    score += 10
  }

  return score
}

export async function searchHousingListings(params: HousingSearchParams): Promise<HousingSearchResult> {
  try {
    const client = getApifyClient()

    // Zillow scraper actor ID - using rigelbytes/zillow-scraper
    const actorId = 'rigelbytes/zillow-scraper'

    // Extract zip code from location or map major cities to representative zip codes
    let zipCode = ''
    const zipMatch = params.location.match(/\b\d{5}(-\d{4})?\b/)
    if (zipMatch) {
      zipCode = zipMatch[0]
    } else {
      // Map major cities to representative zip codes
      const location = params.location.toLowerCase()
      if (location.includes('san francisco')) {
        zipCode = '94102' // San Francisco downtown
      } else if (location.includes('brooklyn')) {
        zipCode = '11201' // Brooklyn Heights
      } else if (location.includes('manhattan') || location.includes('new york')) {
        zipCode = '10001' // Manhattan
      } else if (location.includes('queens')) {
        zipCode = '11101' // Queens
      } else if (location.includes('bronx')) {
        zipCode = '10451' // Bronx
      } else if (location.includes('los angeles')) {
        zipCode = '90210' // Beverly Hills/West LA
      } else if (location.includes('seattle')) {
        zipCode = '98101' // Seattle downtown
      } else if (location.includes('boston')) {
        zipCode = '02101' // Boston downtown
      } else if (location.includes('chicago')) {
        zipCode = '60601' // Chicago downtown
      } else if (location.includes('austin')) {
        zipCode = '78701' // Austin downtown
      } else {
        // Default to NYC if no match found
        zipCode = '10001'
      }
    }

    const input = {
      zip_code: zipCode,
      listing_type: 'for_rent', // Get rental listings instead of for-sale
    }

    console.log('[housing] Starting Zillow search with params:', input)

    const run = await client.actor(actorId).call(input, {
      timeout: 120000, // 2 minutes timeout
    })

    if (!run || !run.defaultDatasetId) {
      throw new Error('Failed to get results from Zillow scraper')
    }

    const { items } = await client.dataset(run.defaultDatasetId).listItems()

    if (!items || items.length === 0) {
      return {
        top_picks: [],
        error: 'No rental listings found for your search criteria. Please try different parameters.',
      }
    }

    console.log(`[housing] Found ${items.length} raw listings, processing...`)

    // Debug: log the first few items to see the actual structure
    console.log('[housing] Sample raw data structure:', JSON.stringify(items.slice(0, 2), null, 2))

    // Process and score listings
    const processedListings: Array<HousingListing & { score: number }> = items
      .filter((item: any) => item && item.address && item.price)
      .map((item: any) => {
        // Debug URL fields
        const urlFields = {
          url: item.url,
          link: item.link,
          href: item.href,
          zillowUrl: item.zillowUrl,
          listing_url: item.listing_url,
          propertyUrl: item.propertyUrl,
          detailUrl: item.detailUrl,
        }
        console.log('[housing] URL fields for listing:', urlFields)

        const listing: HousingListing & { score: number } = {
          price: formatPrice(item.price),
          address: item.address || 'Address not available',
          num_bedrooms: parseInt(item.bedrooms?.toString() || '0'),
          num_bathrooms: parseFloat(item.bathrooms?.toString() || '0'),
          description: item.description || 'Description not available',
          image_url: extractImageUrl(item.images || []),
          zillow_url: item.detailUrl || item.url || item.link || item.href || item.zillowUrl || item.listing_url || item.propertyUrl || '',
          score: scoreProperty(item, params),
        }
        return listing
      })

    // Sort by score (highest first) and take top 3
    const topListings = processedListings
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ score, ...listing }) => listing) // Remove score from final result

    console.log(`[housing] Returning ${topListings.length} top listings`)

    return {
      top_picks: topListings,
    }

  } catch (error) {
    console.error('[housing] Search failed:', error)

    let errorMessage = 'An unexpected error occurred while searching for rentals.'

    if (error instanceof Error) {
      if (error.message.includes('APIFY_API_TOKEN')) {
        errorMessage = 'Housing search is not configured. Please contact support.'
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Search request timed out. Please try again with more specific criteria.'
      } else if (error.message.includes('actor')) {
        errorMessage = 'Housing search service is temporarily unavailable. Please try again later.'
      } else {
        errorMessage = `Search failed: ${error.message}`
      }
    }

    return {
      top_picks: [],
      error: errorMessage,
    }
  }
}