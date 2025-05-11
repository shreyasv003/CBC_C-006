import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import SosButton from './SosButton'
import './RoutePlanner.css'

function RoutePlanner({ onRouteCalculated }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [fromSuggestions, setFromSuggestions] = useState([])
  const [toSuggestions, setToSuggestions] = useState([])
  const [showFromSuggestions, setShowFromSuggestions] = useState(false)
  const [showToSuggestions, setShowToSuggestions] = useState(false)
  const fromInputRef = useRef(null)
  const toInputRef = useRef(null)

  // Debounce function for search
  const debounce = (func, wait) => {
    let timeout
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout)
        func(...args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }

  // Search for location suggestions
  const searchLocation = async (query, setSuggestions) => {
    if (!query || query.length < 3) {
      setSuggestions([])
      return
    }

    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=5&addressdetails=1`
      )
      
      // Filter and format suggestions
      const formattedSuggestions = response.data
        .filter(place => {
          // Ensure the place is in India
          const address = place.address || {}
          return address.country === 'India'
        })
        .map(place => ({
          ...place,
          display_name: formatAddress(place)
        }))
      
      setSuggestions(formattedSuggestions)
    } catch (err) {
      console.error('Error fetching suggestions:', err)
      setSuggestions([])
    }
  }

  // Format address to be more readable
  const formatAddress = (place) => {
    const address = place.address || {}
    const parts = []
    
    if (address.city) parts.push(address.city)
    else if (address.town) parts.push(address.town)
    else if (address.village) parts.push(address.village)
    
    if (address.state) parts.push(address.state)
    
    if (parts.length === 0) return place.display_name
    
    return parts.join(', ')
  }

  // Debounced search functions
  const debouncedFromSearch = useRef(
    debounce((query) => searchLocation(query, setFromSuggestions), 300)
  ).current

  const debouncedToSearch = useRef(
    debounce((query) => searchLocation(query, setToSuggestions), 300)
  ).current

  // Handle input changes
  const handleFromChange = (e) => {
    const value = e.target.value
    setFrom(value)
    if (value.length >= 3) {
      debouncedFromSearch(value)
      setShowFromSuggestions(true)
    } else {
      setFromSuggestions([])
      setShowFromSuggestions(false)
    }
  }

  const handleToChange = (e) => {
    const value = e.target.value
    setTo(value)
    if (value.length >= 3) {
      debouncedToSearch(value)
      setShowToSuggestions(true)
    } else {
      setToSuggestions([])
      setShowToSuggestions(false)
    }
  }

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion, isFrom) => {
    if (isFrom) {
      setFrom(suggestion.display_name)
      setFromSuggestions([])
      setShowFromSuggestions(false)
    } else {
      setTo(suggestion.display_name)
      setToSuggestions([])
      setShowToSuggestions(false)
    }
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (fromInputRef.current && !fromInputRef.current.contains(event.target)) {
        setShowFromSuggestions(false)
      }
      if (toInputRef.current && !toInputRef.current.contains(event.target)) {
        setShowToSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const getCurrentLocation = () => {
    setIsGettingLocation(true)
    setError(null)

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      setIsGettingLocation(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          // Get address from coordinates using reverse geocoding
          const response = await axios.get(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`
          )
          
          if (response.data && response.data.display_name) {
            setFrom(response.data.display_name)
          } else {
            setError('Could not get address from current location')
          }
        } catch (err) {
          setError('Error getting address from current location')
          console.error('Error getting address:', err)
        } finally {
          setIsGettingLocation(false)
        }
      },
      (error) => {
        setError('Error getting current location: ' + error.message)
        setIsGettingLocation(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Get coordinates for both locations
      const [fromResponse, toResponse] = await Promise.all([
        axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(from)}`),
        axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(to)}`)
      ])

      if (fromResponse.data.length === 0 || toResponse.data.length === 0) {
        throw new Error('One or both locations could not be found')
      }

      const fromCoord = {
        lat: parseFloat(fromResponse.data[0].lat),
        lng: parseFloat(fromResponse.data[0].lon)
      }

      const toCoord = {
        lat: parseFloat(toResponse.data[0].lat),
        lng: parseFloat(toResponse.data[0].lon)
      }

      onRouteCalculated(fromCoord, toCoord)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Handle clear input
  const handleClearInput = (isFrom) => {
    if (isFrom) {
      setFrom('')
      setFromSuggestions([])
      setShowFromSuggestions(false)
    } else {
      setTo('')
      setToSuggestions([])
      setShowToSuggestions(false)
    }
  }

  return (
    <div className="route-planner">
      <h2>Plan Your Route</h2>
      <form onSubmit={handleSubmit} className="route-form">
        <div className="form-group" ref={fromInputRef}>
          <div className="input-with-button">
            <div className="input-wrapper">
              <input
                type="text"
                value={from}
                onChange={handleFromChange}
                placeholder="Enter starting location"
                required
              />
              {from && (
                <button
                  type="button"
                  className="clear-button"
                  onClick={() => handleClearInput(true)}
                  title="Clear input"
                >
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
            </div>
            <button
              type="button"
              className="current-location-btn"
              onClick={getCurrentLocation}
              disabled={isGettingLocation}
              title="Use my current location"
            >
              {isGettingLocation ? (
                <span className="button-content">
                  <span className="loading-spinner"></span>
                </span>
              ) : (
                <span className="button-content">
                  <svg className="location-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 22C16 18 20 14.4183 20 10C20 5.58172 16.4183 2 12 2C7.58172 2 4 5.58172 4 10C4 14.4183 8 18 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              )}
            </button>
          </div>
          {showFromSuggestions && fromSuggestions.length > 0 && (
            <div className="suggestions-list">
              {fromSuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="suggestion-item"
                  onClick={() => handleSuggestionSelect(suggestion, true)}
                >
                  {suggestion.display_name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-group" ref={toInputRef}>
          <div className="input-wrapper">
            <input
              type="text"
              value={to}
              onChange={handleToChange}
              placeholder="Enter destination"
              required
            />
            {to && (
              <button
                type="button"
                className="clear-button"
                onClick={() => handleClearInput(false)}
                title="Clear input"
              >
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </div>
          {showToSuggestions && toSuggestions.length > 0 && (
            <div className="suggestions-list">
              {toSuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="suggestion-item"
                  onClick={() => handleSuggestionSelect(suggestion, false)}
                >
                  {suggestion.display_name}
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="submit" className="submit-button" disabled={loading}>
          {loading ? (
            <span className="button-content">
              <span className="loading-spinner"></span>
              Searching...
            </span>
          ) : (
            <span className="button-content">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Search Route
            </span>
          )}
        </button>

        {error && <div className="error-message">{error}</div>}

        {/* Add SOS description inside the form */}
        <p className="sos-description">
          Click in case of emergency to alert authorities and emergency contacts
        </p>
      </form>

      {/* Keep SOS button outside the form */}
      <div className="sos-section">
        <SosButton />
      </div>
    </div>
  )
}

export default RoutePlanner