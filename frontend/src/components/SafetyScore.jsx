import './SafetyScore.css'

function SafetyScore({ score }) {
  const getScoreColor = (score) => {
    if (score >= 8) return 'bg-green-500'
    if (score >= 5) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getScoreDescription = (score) => {
    if (score >= 8) return 'Safe Route'
    if (score >= 5) return 'Moderate Risk'
    return 'High Risk'
  }

  return (
    <div className="safety-score">
      <div className="safety-score-header">
        <h3>Route Safety Analysis</h3>
        <div className={`safety-score-bar ${getScoreColor(score)}`}></div>
      </div>
      <div className="safety-score-content">
        <div className="safety-score-value">
          <span className="score-number">{score}</span>
          <span className="score-max">/10</span>
        </div>
        <p className="safety-score-description">{getScoreDescription(score)}</p>
      </div>
    </div>
  )
}

export default SafetyScore 