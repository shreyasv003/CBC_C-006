import { useState } from 'react'
import MapView from './components/MapView'
import RoutePlanner from './components/RoutePlanner'
import AlertsMenu from './components/AlertsMenu'
import './App.css'

function App() {
  const [fromCoord, setFromCoord] = useState(null)
  const [toCoord, setToCoord] = useState(null)
  const [isAlertsMenuOpen, setIsAlertsMenuOpen] = useState(false)

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <h1>SurakshaPath</h1>
          <p className="subtitle">Safe Route Planning System</p>
        </div>
        <button 
          className="hamburger-menu"
          onClick={() => setIsAlertsMenuOpen(true)}
          aria-label="Open alerts menu"
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </header>
      
      <main className="main-content">
        <div className="left-panel">
          <RoutePlanner 
            onRouteCalculated={(from, to) => {
              setFromCoord(from)
              setToCoord(to)
            }}
          />
        </div>
        
        <div className="map-container">
          <MapView fromCoord={fromCoord} toCoord={toCoord} />
        </div>
      </main>

      <AlertsMenu 
        isOpen={isAlertsMenuOpen}
        onClose={() => setIsAlertsMenuOpen(false)}
      />
    </div>
  )
}

export default App