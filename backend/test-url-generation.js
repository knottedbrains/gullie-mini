// Test URL generation
const location = "Brooklyn, NY";
const maxPrice = 2500;
const bedrooms = 2;

// Build Zillow search URL with proper format
let searchUrl = 'https://www.zillow.com/homes/for_rent/'

// Add location to search
const locationParts = location.split(',').map(part => part.trim())
if (locationParts.length >= 2) {
  // Format: "City, State" -> "City-State"
  searchUrl += `${locationParts[0].replace(/\s+/g, '-')}-${locationParts[1].replace(/\s+/g, '')}/`
} else {
  searchUrl += `${location.replace(/\s+/g, '-')}/`
}

// Add filters as URL parameters
const urlParams = new URLSearchParams()
if (maxPrice) urlParams.append('price', `-${maxPrice}`)
if (bedrooms) urlParams.append('beds', bedrooms.toString())

if (urlParams.toString()) {
  searchUrl += '?' + urlParams.toString()
}

console.log('Generated URL:', searchUrl)