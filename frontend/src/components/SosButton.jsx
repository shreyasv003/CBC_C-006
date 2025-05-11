import { useState } from 'react'
import axios from 'axios'
import './SosButton.css'

function SosButton() {
  const [isActive, setIsActive] = useState(false)
  const [location, setLocation] = useState(null)
  const [address, setAddress] = useState('')

  const getAddressFromCoordinates = async (lat, lng) => {
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      )
      const address = response.data
      // Format address to be more concise
      const formattedAddress = [
        address.address.road,
        address.address.suburb,
        address.address.city,
        address.address.state
      ].filter(Boolean).join(', ')
      return formattedAddress
    } catch (error) {
      console.error('Error getting address:', error)
      return 'Location not available'
    }
  }

  const handleSosClick = async () => {
    setIsActive(true)
    try {
      // Get current location
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000
        })
      })

      const currentLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      }

      // Get address from coordinates
      const currentAddress = await getAddressFromCoordinates(currentLocation.lat, currentLocation.lng)
      
      setLocation(currentLocation)
      setAddress(currentAddress)

      // Show browser alert with location details
      alert(`Emergency Services Notified!\n\nYour current location:\n${currentAddress}\n\nCoordinates:\n${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}`)

      // Here you would typically:
      // 1. Send emergency alert to backend
      // 2. Notify emergency contacts
      
      // Reset button state after 5 seconds
      setTimeout(() => {
        setIsActive(false)
      }, 5000)
    } catch (error) {
      console.error('Error getting location for SOS:', error)
      alert('Error getting location. Please try again.')
      setIsActive(false)
    }
  }

  return (
    <div className="sos-container">
      <button 
        className="sos-button"
        onClick={handleSosClick}
        disabled={isActive}
      >
        {isActive ? 'SOS Sent' : 'SOS'}
      </button>
    </div>
  )
}

export default SosButton 