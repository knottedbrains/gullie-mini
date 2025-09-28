import { useCallback, useState } from 'react'
import { Home, Loader2, MapPin, DollarSign, Bed } from 'lucide-react'
import clsx from 'clsx'
import type { TaskAction } from '../types/timeline'

type HousingSearchAction = Extract<TaskAction, { type: 'housing_search' }>

interface HousingSearchActionCardProps {
  taskId: string
  action: HousingSearchAction
}

interface HousingListing {
  price: string
  address: string
  num_bedrooms: number
  num_bathrooms: number
  description: string
  image_url: string
  zillow_url: string
}

interface HousingSearchResult {
  top_picks: HousingListing[]
  error?: string
}

const MAJOR_CITIES = [
  { value: 'New York, NY', label: 'New York, NY' },
  { value: 'San Francisco, CA', label: 'San Francisco, CA' },
  { value: 'Brooklyn, NY', label: 'Brooklyn, NY' },
  { value: 'Los Angeles, CA', label: 'Los Angeles, CA' },
  { value: 'Seattle, WA', label: 'Seattle, WA' },
  { value: 'Boston, MA', label: 'Boston, MA' },
  { value: 'Chicago, IL', label: 'Chicago, IL' },
  { value: 'Austin, TX', label: 'Austin, TX' },
]

export function HousingSearchActionCard({ action }: HousingSearchActionCardProps) {
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<HousingSearchResult | null>(null)
  const [formData, setFormData] = useState({
    location: 'New York, NY',
    maxPrice: 3000,
    bedrooms: 2,
  })

  const handleSearch = useCallback(async () => {
    if (isSearching) return

    setIsSearching(true)
    setResults(null)

    try {
      const response = await fetch('/api/housing/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`)
      }

      const data: HousingSearchResult = await response.json()
      setResults(data)
    } catch (error) {
      console.error('Housing search failed:', error)
      setResults({
        top_picks: [],
        error: error instanceof Error ? error.message : 'Search failed',
      })
    } finally {
      setIsSearching(false)
    }
  }, [formData, isSearching])

  const handleInputChange = useCallback((field: keyof typeof formData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }))
  }, [])

  return (
    <div className="space-y-4 rounded-lg border border-white/20 bg-white/5 p-4">
      <div className="flex items-center gap-2">
        <Home className="h-4 w-4 text-blue-400" />
        <span className="text-sm font-medium text-white">{action.label}</span>
      </div>

      {action.instructions && (
        <p className="text-xs text-slate-300/90">{action.instructions}</p>
      )}

      {/* Search Form */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* City Selection */}
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-xs font-medium text-slate-300">
              <MapPin className="h-3 w-3" />
              City
            </label>
            <select
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {MAJOR_CITIES.map((city) => (
                <option key={city.value} value={city.value} className="bg-slate-800 text-white">
                  {city.label}
                </option>
              ))}
            </select>
          </div>

          {/* Budget */}
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-xs font-medium text-slate-300">
              <DollarSign className="h-3 w-3" />
              Max Budget
            </label>
            <input
              type="number"
              value={formData.maxPrice}
              onChange={(e) => handleInputChange('maxPrice', parseInt(e.target.value) || 0)}
              placeholder="3000"
              className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          {/* Bedrooms */}
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-xs font-medium text-slate-300">
              <Bed className="h-3 w-3" />
              Bedrooms
            </label>
            <select
              value={formData.bedrooms}
              onChange={(e) => handleInputChange('bedrooms', parseInt(e.target.value))}
              className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value={1} className="bg-slate-800 text-white">1 Bedroom</option>
              <option value={2} className="bg-slate-800 text-white">2 Bedrooms</option>
              <option value={3} className="bg-slate-800 text-white">3 Bedrooms</option>
              <option value={4} className="bg-slate-800 text-white">4+ Bedrooms</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={isSearching}
          className={clsx(
            'flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            isSearching
              ? 'bg-blue-500/50 text-blue-200 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900'
          )}
        >
          {isSearching ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Home className="h-4 w-4" />
              Find Apartments
            </>
          )}
        </button>
      </div>

      {/* Search Results */}
      {results && (
        <div className="space-y-3">
          {results.error ? (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              <strong>Search failed:</strong> {results.error}
            </div>
          ) : results.top_picks.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-white">Top Picks</h4>
              <div className="space-y-3">
                {results.top_picks.map((listing, index) => (
                  <div
                    key={index}
                    className="rounded-md border border-white/15 bg-white/5 p-3 transition-colors hover:bg-white/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">{listing.price}</span>
                          {listing.num_bedrooms > 0 && (
                            <span className="text-xs text-slate-300">
                              {listing.num_bedrooms} bed{listing.num_bedrooms !== 1 ? 's' : ''}
                            </span>
                          )}
                          {listing.num_bathrooms > 0 && (
                            <span className="text-xs text-slate-300">
                              {listing.num_bathrooms} bath{listing.num_bathrooms !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300">{listing.address}</p>
                        {listing.description !== 'Description not available' && (
                          <p className="text-xs text-slate-400">{listing.description}</p>
                        )}
                      </div>
                      {listing.image_url && !listing.image_url.includes('placeholder') && (
                        <img
                          src={listing.image_url}
                          alt="Property"
                          className="h-12 w-16 rounded object-cover"
                        />
                      )}
                    </div>
                    {listing.zillow_url && (
                      <div className="mt-2">
                        <a
                          href={listing.zillow_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline"
                        >
                          View on Zillow →
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-200">
              No listings found for your criteria. Try adjusting your search parameters.
            </div>
          )}
        </div>
      )}
    </div>
  )
}