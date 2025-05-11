import { useState, useEffect } from 'react'
import axios from 'axios'
import './AlertsMenu.css'

function AlertsMenu({ isOpen, onClose }) {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/alerts')
        console.log('Fetched alerts:', response.data)
        setAlerts(response.data)
        setLoading(false)
      } catch (err) {
        setError('Failed to fetch alerts')
        setLoading(false)
        console.error('Error fetching alerts:', err)
      }
    }

    if (isOpen) {
      fetchAlerts()
    }
  }, [isOpen])

  const getAlertColor = (type) => {
    switch(type) {
      case 'terrorism': return '#FF0000'
      case 'protest': return '#FFA500'
      case 'theft': return '#FFD700'
      case 'accident': return '#800080'
      default: return '#808080'
    }
  }

  const groupAlertsByCity = (alerts) => {
    console.log('Grouping alerts by city:', alerts)
    const groups = alerts.reduce((groups, alert) => {
      const city = alert.city || 'Unknown Location'
      if (!groups[city]) {
        groups[city] = []
      }
      groups[city].push(alert)
      return groups
    }, {})
    console.log('Grouped alerts:', groups)
    return groups
  }

  if (!isOpen) return null

  const groupedAlerts = groupAlertsByCity(alerts)

  return (
    <div className="alerts-menu-overlay" onClick={onClose}>
      <div className="alerts-menu" onClick={e => e.stopPropagation()}>
        <div className="alerts-menu-header">
          <h2>Active Alerts</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="alerts-content">
          {loading ? (
            <div className="loading">Loading alerts...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : alerts.length === 0 ? (
            <div className="no-alerts">No active alerts</div>
          ) : (
            <div className="alerts-list">
              {Object.entries(groupedAlerts).map(([city, cityAlerts]) => (
                <div key={city} className="city-group">
                  <h3 className="city-header">{city}</h3>
                  {cityAlerts.map((alert, index) => (
                    <div 
                      key={index} 
                      className="alert-item"
                      style={{ borderLeftColor: getAlertColor(alert.type) }}
                    >
                      <div className="alert-header">
                        <span className="alert-type">{alert.type}</span>
                        <span className="alert-severity">{alert.severity}</span>
                      </div>
                      <p className="alert-description">{alert.description}</p>
                      <div className="alert-location">
                        <span className="location-label">Location:</span>
                        <span className="location-value">
                          {alert.lat.toFixed(4)}, {alert.lng.toFixed(4)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AlertsMenu 