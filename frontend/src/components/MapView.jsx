import { MapContainer, TileLayer, Circle, Popup, useMap, Marker, Polygon } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css'
import { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png'
import SafetyScore from './SafetyScore'
import SosButton from './SosButton'
import './MapView.css'

// Import Leaflet Routing Machine
import 'leaflet-routing-machine'

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetina,
  iconUrl: icon,
  shadowUrl: iconShadow,
})

// Custom icons for navigation
const currentLocationIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

// Navigation needle icon
const navigationNeedleIcon = L.divIcon({
  className: 'navigation-needle',
  html: `
    <div class="needle-container">
      <div class="needle-arrow"></div>
      <div class="needle-circle"></div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18]
})

// Function to calculate distance between two points
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371 // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c // Distance in km
}

// Function to estimate travel time based on distance
const estimateTravelTime = (distance) => {
  // Average speed in km/h
  const averageSpeed = 50 // 50 km/h average speed based on real-world data

  // Calculate time in hours
  const timeInHours = distance / averageSpeed

  // Convert to minutes
  return Math.round(timeInHours * 60)
}

// Pakistan boundary coordinates (simplified)
const pakistanBoundary = [
  [37.0841, 74.7482], // Northernmost point
  [36.9524, 72.3318],
  [35.8989, 71.8024],
  [35.4807, 71.6117],
  [34.5718, 70.2724],
  [33.9389, 69.6113],
  [32.4021, 69.1472],
  [31.5820, 68.5459],
  [30.7135, 67.3454],
  [29.8615, 66.3435],
  [28.5973, 65.1378],
  [27.7051, 63.2487],
  [26.4720, 61.7717],
  [25.2370, 61.4973],
  [24.8465, 61.5508],
  [24.6637, 67.1454],
  [24.1517, 68.8425],
  [23.6919, 70.2144],
  [23.2507, 70.2708],
  [22.6557, 70.9574],
  [22.0000, 72.0000],
  [21.7133, 72.8234],
  [22.4927, 73.0535],
  [23.2507, 72.0000],
  [24.0000, 71.0000],
  [25.0000, 70.0000],
  [26.0000, 70.0000],
  [27.0000, 71.0000],
  [28.0000, 72.0000],
  [29.0000, 73.0000],
  [30.0000, 74.0000],
  [31.0000, 75.0000],
  [32.0000, 76.0000],
  [33.0000, 77.0000],
  [34.0000, 78.0000],
  [35.0000, 79.0000],
  [36.0000, 80.0000],
  [37.0841, 74.7482]  // Back to start
]

// Function to get address from coordinates
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

// Component to handle live navigation
function LiveNavigation({ destination, onNavigationUpdate }) {
  const map = useMap()
  const [currentLocation, setCurrentLocation] = useState(null)
  const [currentStep, setCurrentStep] = useState(null)
  const [remainingDistance, setRemainingDistance] = useState(null)
  const [remainingTime, setRemainingTime] = useState(null)
  const watchId = useRef(null)
  const routingControl = useRef(null)
  const currentMarker = useRef(null)
  const destinationMarker = useRef(null)
  const routeLine = useRef(null)

  // Initial route calculation
  useEffect(() => {
    if (destination) {
      // Add destination marker
      destinationMarker.current = L.marker([destination.lat, destination.lng], {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      }).addTo(map).bindPopup('Destination')

      // Get initial location
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const initialLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
          console.log('Initial location:', initialLocation)
          setCurrentLocation(initialLocation)
          updateRoute(initialLocation, destination)
        },
        (error) => {
          console.error('Error getting initial location:', error)
        },
        {
          enableHighAccuracy: true,
          timeout: 5000
        }
      )
    }

    // Cleanup function
    return () => {
      if (destinationMarker.current) {
        map.removeLayer(destinationMarker.current)
      }
    }
  }, [destination, map])

  // Watch for location updates
  useEffect(() => {
    if (!destination) return

    console.log('Starting location watch')
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }
        console.log('Location update:', newLocation)
        setCurrentLocation(newLocation)

        // Update marker position
        if (currentMarker.current) {
          currentMarker.current.setLatLng([newLocation.lat, newLocation.lng])
          // Update marker rotation based on heading
          const needleElement = currentMarker.current.getElement()
          if (needleElement) {
            const container = needleElement.querySelector('.needle-container')
            if (container) {
              container.style.transform = `rotate(${position.coords.heading || 0}deg)`
            }
          }
        } else {
          currentMarker.current = L.marker([newLocation.lat, newLocation.lng], {
            icon: navigationNeedleIcon,
            rotationAngle: position.coords.heading || 0
          }).addTo(map)
        }

        // Update route
        updateRoute(newLocation, destination)
      },
      (error) => {
        console.error('Error watching location:', error)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
      }
    )

    return () => {
      if (watchId.current) {
        navigator.geolocation.clearWatch(watchId.current)
      }
    }
  }, [map, destination])

  const updateRoute = (from, to) => {
    console.log('Updating route:', { from, to })

    // Remove existing route line if it exists
    if (routeLine.current) {
      map.removeLayer(routeLine.current)
    }

    // Create a new routing control
    const control = L.Routing.control({
      waypoints: [
        L.latLng(from.lat, from.lng),
        L.latLng(to.lat, to.lng)
      ],
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      lineOptions: {
        styles: [
          { color: '#3b82f6', weight: 4, opacity: 0.7 }
        ]
      },
      createMarker: () => null,
      show: false,
      showAlternatives: false,
      useZoomParameter: false,
      router: L.Routing.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1',
        profile: 'driving'
      })
    })

    // Remove existing routing control if it exists
    if (routingControl.current) {
      map.removeControl(routingControl.current)
    }

    // Add the new routing control to the map
    routingControl.current = control
    control.addTo(map)

    // Handle route found event
    control.on('routesfound', (e) => {
      console.log('Route found:', e.routes[0])
      const route = e.routes[0]

      // Create a polyline for the route
      const routePoints = route.coordinates.map(coord => [coord.lat, coord.lng])
      routeLine.current = L.polyline(routePoints, {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.7
      }).addTo(map)

      const currentPoint = L.latLng(from.lat, from.lng)

      // Find the current step
      let currentStepIndex = 0
      let minDistance = Infinity

      route.instructions.forEach((instruction, index) => {
        const distance = currentPoint.distanceTo(L.latLng(instruction.coords[0], instruction.coords[1]))
        if (distance < minDistance) {
          minDistance = distance
          currentStepIndex = index
        }
      })

      // Get the current instruction
      const currentInstruction = route.instructions[currentStepIndex]

      // Calculate remaining distance and time
      let remainingDist = 0
      let remainingTime = 0

      for (let i = currentStepIndex; i < route.instructions.length; i++) {
        remainingDist += route.instructions[i].distance
        remainingTime += route.instructions[i].time
      }

      // Update state
      setCurrentStep(currentInstruction)
      setRemainingDistance(remainingDist / 1000) // Convert to km
      setRemainingTime(Math.round(remainingTime / 60)) // Convert to minutes

      // Notify parent component with navigation info
      const navigationInfo = {
        currentStep: {
          text: currentInstruction.text,
          distance: currentInstruction.distance,
          time: currentInstruction.time
        },
        remainingDistance: remainingDist / 1000,
        remainingTime: Math.round(remainingTime / 60)
      }
      console.log('Sending navigation update:', navigationInfo)
      onNavigationUpdate(navigationInfo)

      // Center map on current location
      map.setView([from.lat, from.lng], map.getZoom())
    })

    // Handle routing error
    control.on('routingerror', (e) => {
      console.error('Routing error:', e)
      // Calculate distance and time without showing the line
      const distance = calculateDistance(from.lat, from.lng, to.lat, to.lng)
      const estimatedTime = estimateTravelTime(distance) // Use the new calculation

      // Send a simplified navigation update
      onNavigationUpdate({
        currentStep: {
          text: 'Proceed to destination',
          distance: distance * 1000, // Convert to meters
          time: estimatedTime * 60 // Convert to seconds
        },
        remainingDistance: distance,
        remainingTime: estimatedTime
      })
    })
  }

  return null
}

// Component to draw route using Leaflet Routing Machine
function RouteDrawer({ from, to, alerts, onRouteCalculated }) {
  const map = useMap()
  const routingControl = useRef(null)
  const routeLine = useRef(null)
  const startMarker = useRef(null)
  const endMarker = useRef(null)

  // Cleanup function
  const cleanup = () => {
    console.log('Cleaning up route elements')
    try {
      // Remove all existing routing controls
      map.eachLayer((layer) => {
        if (layer instanceof L.Routing.Control) {
          map.removeControl(layer)
        }
      })

      // Remove all polylines
      map.eachLayer((layer) => {
        if (layer instanceof L.Polyline) {
          map.removeLayer(layer)
        }
      })

      // Don't remove markers during cleanup
      routeLine.current = null
      routingControl.current = null
    } catch (error) {
      console.error('Error during cleanup:', error)
    }
  }

  // Effect for cleanup when coordinates change
  useEffect(() => {
    console.log('Coordinates changed, cleaning up previous route')
    cleanup()
    return () => {
      console.log('Component unmounting, cleaning up route')
      cleanup()
    }
  }, [from, to])

  // Effect to handle markers separately
  useEffect(() => {
    // Remove existing markers
    if (startMarker.current) {
      map.removeLayer(startMarker.current)
    }
    if (endMarker.current) {
      map.removeLayer(endMarker.current)
    }

    // Create new markers
    if (from) {
      startMarker.current = L.marker([from.lat, from.lng], {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      }).addTo(map).bindPopup('Start Point')
    }

    if (to) {
      endMarker.current = L.marker([to.lat, to.lng], {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      }).addTo(map).bindPopup('Destination')
    }

    return () => {
      if (startMarker.current) {
        map.removeLayer(startMarker.current)
      }
      if (endMarker.current) {
        map.removeLayer(endMarker.current)
      }
    }
  }, [map, from, to])

  useEffect(() => {
    if (!from || !to) {
      console.log('Missing coordinates, cleaning up route')
      return
    }

    console.log('Drawing new route between:', from, to)

    // Initial zoom to show both points
    const bounds = L.latLngBounds([
      [from.lat, from.lng],
      [to.lat, to.lng]
    ])
    map.fitBounds(bounds, {
      padding: [50, 50]
    })

    // Create a new routing control
    const control = L.Routing.control({
      waypoints: [
        L.latLng(from.lat, from.lng),
        L.latLng(to.lat, to.lng)
      ],
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      lineOptions: {
        styles: [
          { color: '#3b82f6', weight: 4, opacity: 0.7 }
        ]
      },
      createMarker: () => null,
      show: false,
      showAlternatives: false,
      useZoomParameter: false,
      router: L.Routing.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1',
        profile: 'driving'
      })
    })

    // Add custom CSS to hide routing control elements
    const style = document.createElement('style')
    style.textContent = `
      .leaflet-routing-container {
        display: none !important;
      }
      .leaflet-routing-alt {
        display: none !important;
      }
      .leaflet-routing-error {
        display: none !important;
      }
      .leaflet-routing-alternatives-container {
        display: none !important;
      }
      .leaflet-routing-geocoders {
        display: none !important;
      }
      .leaflet-routing-geocoder {
        display: none !important;
      }
      .leaflet-routing-geocoder-form {
        display: none !important;
      }
      .leaflet-routing-geocoder-input {
        display: none !important;
      }
      .leaflet-routing-geocoder-button {
        display: none !important;
      }
    `
    document.head.appendChild(style)

    // Add the new routing control to the map
    routingControl.current = control
    control.addTo(map)

    // Handle route found event
    control.on('routesfound', (e) => {
      console.log('Route found:', e.routes[0])
      const route = e.routes[0]

      // Remove any existing route line before creating a new one
      cleanup()

      // Create a polyline for the route
      const routePoints = route.coordinates.map(coord => [coord.lat, coord.lng])
      routeLine.current = L.polyline(routePoints, {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.7,
        smoothFactor: 1
      }).addTo(map)

      // Calculate total distance
      const totalDistance = route.summary.totalDistance / 1000 // Convert to km

      // Calculate estimated time based on distance
      const estimatedTime = estimateTravelTime(totalDistance)

      // Calculate safety score based on alerts
      let safetyScore = 10 // Start with maximum score of 10
      if (alerts && alerts.length > 0) {
        console.log('Checking alerts along route. Total alerts:', alerts.length)

        // Check each point along the route for nearby alerts
        let alertCount = 0
        let isInHighRiskZone = false

        // Get all route points
        const routePoints = route.coordinates.map(coord => [coord.lat, coord.lng])

        // Check each alert against all route points
        alerts.forEach(alert => {
          let minDistance = Infinity

          // Find minimum distance to any point on the route
          routePoints.forEach(point => {
            const distance = calculateDistance(point[0], point[1], alert.lat, alert.lng)
            minDistance = Math.min(minDistance, distance)
          })

          // If alert is within 20km of any point on the route
          if (minDistance < 20) {
            console.log(`Alert minimum distance to route: ${minDistance.toFixed(2)}km`)
            alertCount++

            // Check if route passes through the risk zone (within 1km)
            if (minDistance < 1) {
              isInHighRiskZone = true
              safetyScore = Math.min(safetyScore, 3) // Direct risk zone
            } else if (minDistance < 5) {
              safetyScore = Math.min(safetyScore, 5) // High risk zone
            } else if (minDistance < 10) {
              safetyScore = Math.min(safetyScore, 7) // Medium risk zone
            } else {
              safetyScore = Math.min(safetyScore, 8) // Low risk zone
            }
          }
        })

        console.log('Alert summary:', {
          totalAlerts: alertCount,
          isInHighRiskZone,
          safetyScore
        })

        // Apply additional penalties based on number of alerts
        if (alertCount > 0) {
          // Reduce score by 0.5 for each alert, but not below 1
          safetyScore = Math.max(1, safetyScore - (alertCount * 0.5))
        }

        // Round to one decimal place
        safetyScore = Math.round(safetyScore * 10) / 10
      }

      console.log('Final calculated safety score:', safetyScore)
      // Notify parent component
      onRouteCalculated(safetyScore, totalDistance, estimatedTime)

      // Fit map to show the entire route with markers
      const routeBounds = routeLine.current.getBounds()
      map.fitBounds(routeBounds, {
        padding: [50, 50]
      })
    })

    // Handle routing error
    control.on('routingerror', (e) => {
      console.error('Routing error:', e)
      cleanup()

      // Calculate direct distance
      const directDistance = calculateDistance(from.lat, from.lng, to.lat, to.lng)

      // Create a direct line between points
      const directLine = L.polyline([[from.lat, from.lng], [to.lat, to.lng]], {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.7,
        dashArray: '5, 10'
      }).addTo(map)

      routeLine.current = directLine

      // Calculate estimated time
      const estimatedTime = estimateTravelTime(directDistance)

      // Notify parent component with direct route info
      onRouteCalculated(10, directDistance, estimatedTime)

      // Fit map to show both markers
      const bounds = L.latLngBounds([
        [from.lat, from.lng],
        [to.lat, to.lng]
      ])
      map.fitBounds(bounds, {
        padding: [50, 50]
      })
    })

    return () => {
      cleanup()
    }
  }, [map, from, to, alerts, onRouteCalculated])

  return null
}

// Main MapView component
function MapView({ fromCoord, toCoord }) {
  const [alerts, setAlerts] = useState([])
  const [error, setError] = useState(null)
  const [safetyScore, setSafetyScore] = useState(null)
  const [routeDistance, setRouteDistance] = useState(null)
  const [isNavigating, setIsNavigating] = useState(false)
  const [navigationInfo, setNavigationInfo] = useState(null)
  const mapRef = useRef(null)
  const [mapKey, setMapKey] = useState(0)
  const [showSOSAlert, setShowSOSAlert] = useState(false)
  const [sosLocation, setSOSLocation] = useState(null)
  const [sosAddress, setSOSAddress] = useState('')

  // Force re-render when coordinates change
  useEffect(() => {
    setMapKey(prev => prev + 1)
  }, [fromCoord, toCoord])

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/alerts')
        setAlerts(response.data)
      } catch (err) {
        setError('Failed to fetch alerts')
        console.error('Error fetching alerts:', err)
      }
    }

    fetchAlerts()
  }, [])

  const handleRouteCalculated = (score, distance, estimatedTime) => {
    setSafetyScore(score)
    setRouteDistance(distance)
  }

  const handleNavigationUpdate = (info) => {
    console.log('Navigation update received:', info)
    if (info && info.currentStep) {
      setNavigationInfo(info)
    }
  }

  const startNavigation = () => {
    console.log('Starting navigation with coordinates:', { fromCoord, toCoord })
    if (!fromCoord || !toCoord) {
      console.error('Missing coordinates for navigation')
      return
    }
    setIsNavigating(true)
    setNavigationInfo(null)
    if (fromCoord && mapRef.current) {
      mapRef.current.setView([fromCoord.lat, fromCoord.lng], 15)
    }
  }

  const stopNavigation = () => {
    console.log('Stopping navigation')
    setIsNavigating(false)
    setNavigationInfo(null)
    if (fromCoord && toCoord && mapRef.current) {
      const bounds = L.latLngBounds([
        [fromCoord.lat, fromCoord.lng],
        [toCoord.lat, toCoord.lng]
      ])
      mapRef.current.fitBounds(bounds, { padding: [50, 50] })
    }
  }

  const formatDistance = (distance) => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`
    }
    return `${distance.toFixed(1)}km`
  }

  const formatTime = (minutes) => {
    if (minutes < 60) {
      return `${minutes} min`
    }
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    if (remainingMinutes === 0) {
      return `${hours} hr`
    }
    return `${hours} hr ${remainingMinutes} min`
  }

  const getTurnIcon = (instruction) => {
    if (!instruction || !instruction.text) return '→'
    const text = instruction.text.toLowerCase()
    if (text.includes('left')) return '↶'
    if (text.includes('right')) return '↷'
    if (text.includes('straight')) return '↑'
    if (text.includes('roundabout')) return '⟳'
    if (text.includes('destination')) return '★'
    return '→'
  }

  // Add this function to handle SOS click
  const handleSOSClick = async () => {
    try {
      // Get current location
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000
        })
      })

      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      }

      // Get address from coordinates
      const address = await getAddressFromCoordinates(location.lat, location.lng)

      setSOSLocation(location)
      setSOSAddress(address)
      setShowSOSAlert(true)

      // Hide the alert after 5 seconds
      setTimeout(() => {
        setShowSOSAlert(false)
      }, 5000)
    } catch (error) {
      console.error('Error getting location for SOS:', error)
    }
  }

  return (
    <div className="map-view">
      <div className="map-container">
        <MapContainer
          key={mapKey}
          center={[22.9734, 78.6569]}
          zoom={5}
          className="leaflet-container"
          scrollWheelZoom={true}
          ref={mapRef}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {alerts.map((a, i) => (
            <Circle
              key={i}
              center={[a.lat, a.lng]}
              radius={a.severity === 'high' ? 5000 : 3000}
              pathOptions={{
                color: '#FF0000',
                fillColor: '#FF0000',
                fillOpacity: 0.3,
                weight: 2
              }}
            >
              <Popup>
                <strong>{a.type || 'Alert'}</strong><br />
                {a.description}
              </Popup>
            </Circle>
          ))}

          {fromCoord && toCoord && !isNavigating && (
            <RouteDrawer
              key={`route-${mapKey}`}
              from={fromCoord}
              to={toCoord}
              alerts={alerts}
              onRouteCalculated={handleRouteCalculated}
            />
          )}
          {fromCoord && toCoord && isNavigating && (
            <LiveNavigation
              key={`nav-${mapKey}`}
              destination={toCoord}
              onNavigationUpdate={handleNavigationUpdate}
            />
          )}
        </MapContainer>
      </div>

      {!isNavigating && (safetyScore !== null || routeDistance !== null) && (
        <div className="safety-score-container">
          {safetyScore !== null && <SafetyScore score={safetyScore} />}
          {routeDistance !== null && (
            <div className="route-distance">
              <span className="distance-label">Total Distance:</span>
              <span className="distance-value">{routeDistance.toFixed(1)} km</span>
            </div>
          )}
          <button
            className="start-navigation-btn"
            onClick={startNavigation}
          >
            Start Navigation
          </button>
        </div>
      )}

      {isNavigating && (
        <div className="navigation-container">
          {navigationInfo ? (
            <>
              <div className="navigation-info">
                <div className="navigation-step">
                  <div className="turn-icon">{getTurnIcon(navigationInfo.currentStep)}</div>
                  <span className="step-text">
                    {navigationInfo.currentStep?.text || 'Calculating route...'}
                  </span>
                </div>
                <div className="navigation-details">
                  <div className="detail-item">
                    <span className="detail-label">Remaining Distance:</span>
                    <span className="detail-value">
                      {formatDistance(navigationInfo.remainingDistance)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Time to Destination:</span>
                    <span className="detail-value">
                      {formatTime(navigationInfo.remainingTime)}
                    </span>
                  </div>
                </div>
              </div>
              <button
                className="stop-navigation-btn"
                onClick={stopNavigation}
              >
                Stop Navigation
              </button>
            </>
          ) : (
            <div className="navigation-info">
              <div className="navigation-step">
                <span className="step-text">Calculating route...</span>
              </div>
            </div>
          )}
        </div>
      )}

      {showSOSAlert && (
        <div className="sos-alert">
          <div className="sos-alert-content">
            <h3>Emergency Services Notified</h3>
            <p>Your current location:</p>
            <p className="sos-address">{sosAddress}</p>
            <p className="sos-coordinates">
              {sosLocation && `${sosLocation.lat.toFixed(6)}, ${sosLocation.lng.toFixed(6)}`}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </div>
  )
}

export default MapView