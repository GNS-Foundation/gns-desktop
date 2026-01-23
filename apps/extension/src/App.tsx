import './App.css'
import { useGNS } from './hooks/useGNS'

function App() {
  const { isPaired, pairDevice, status, identity, generateProof } = useGNS()

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo">GNS Verified</div>
        <div className="text-xs text-secondary opacity-70" style={{ color: '#a0a0a0', fontSize: '12px' }}>
          Core: {status === 'loading' ? 'Initializing...' : status === 'ready' ? 'Active' : 'Error'}
        </div>
      </header>

      <div className={`status-card ${isPaired ? 'border-accent' : ''}`} style={{ borderColor: isPaired ? '#00f0ff' : undefined }}>
        <div className="status-icon" style={{ borderColor: isPaired ? '#00f0ff' : undefined, color: isPaired ? '#00f0ff' : undefined }}>
          {isPaired ? '✅' : '⚠️'}
        </div>
        <p className="status-text">{isPaired ? 'Device Secured' : 'Device Not Paired'}</p>
        {isPaired && (
          <div className="text-xs text-secondary mt-2">
            Identity: {identity?.public_key.slice(0, 8)}...
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 w-full">
        <button className="action-btn" onClick={pairDevice} disabled={isPaired}>
          {isPaired ? 'Connection Active' : 'Pair New Device'}
        </button>
        {isPaired && (
          <button className="action-btn" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)' }} onClick={() => {
            const proof = generateProof();
            if (proof) {
              navigator.clipboard.writeText(proof);
              alert("Mock Proof copied to clipboard!");
            }
          }}>
            Copy Mock Proof
          </button>
        )}
      </div>
    </div>
  )
}

export default App
