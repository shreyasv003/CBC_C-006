import { useState } from 'react'

function Chatbot() {
  const [visible, setVisible] = useState(false)
  const [messages, setMessages] = useState([])

  const handleSend = (msg) => {
    setMessages([...messages, { from: 'user', text: msg }, { from: 'bot', text: 'We’re here. Stay calm. Call 100 if needed.' }])
  }

  return (
    <div>
      {!visible ? (
        <button className="btn btn-error rounded-full" onClick={() => setVisible(true)}>SOS</button>
      ) : (
        <div className="card w-72 bg-white shadow-xl">
          <div className="card-body p-4 space-y-2">
            <h2 className="card-title">Emergency Chat</h2>
            <div className="overflow-y-auto max-h-48 text-sm">
              {messages.map((m, i) => (
                <div key={i} className={m.from === 'user' ? 'text-right' : 'text-left'}>
                  <p className="bg-gray-100 rounded p-2 inline-block m-1">{m.text}</p>
                </div>
              ))}
            </div>
            <input
              type="text"
              placeholder="Type message..."
              className="input input-bordered w-full"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSend(e.target.value)
                  e.target.value = ''
                }
              }}
            />
            <div className="text-right">
              <button onClick={() => setVisible(false)} className="btn btn-sm btn-outline btn-error">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Chatbot
