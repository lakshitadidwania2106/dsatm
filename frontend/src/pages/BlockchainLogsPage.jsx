import { useState, useEffect } from 'react'
import { Link2, Clock, MapPin, AlertCircle, CheckCircle } from 'lucide-react'
import { useI18n } from '../hooks/useI18n'
import './BlockchainLogsPage.css'

// Mock contract address and ABI (from deployment)
const CONTRACT_ADDRESS = '0x42E257F26C99D54580218f76d63D7f7A2A992A32' // Mock address
const CONTRACT_ABI = [
  {
    inputs: [
      { internalType: 'string', name: '_reportType', type: 'string' },
      { internalType: 'string', name: '_locationDetails', type: 'string' },
      { internalType: 'uint256', name: '_severity', type: 'uint256' },
      { internalType: 'string', name: '_description', type: 'string' },
    ],
    name: 'submitReport',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getReportCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_index', type: 'uint256' }],
    name: 'getReport',
    outputs: [
      { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
      { internalType: 'address', name: 'reporter', type: 'address' },
      { internalType: 'string', name: 'reportType', type: 'string' },
      { internalType: 'string', name: 'locationDetails', type: 'string' },
      { internalType: 'uint256', name: 'severity', type: 'uint256' },
      { internalType: 'string', name: 'description', type: 'string' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
]

// Mock blockchain logs (simulating fetched data)
const generateMockLogs = () => {
  const mockLogs = [
    {
      id: 0,
      timestamp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      reporter: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      reportType: 'Delay',
      locationDetails: 'Bus 304A near Connaught Place',
      severity: 3,
      description: 'Bus delayed by 15 minutes due to traffic',
      txHash: '0x6a2c34d8b9d033f22c608b0a9f5d471e8c9527a20c78a1a3672e8f1929d20c4a',
    },
    {
      id: 1,
      timestamp: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
      reporter: '0x8ba1f109551bD432803012645Hac136c22C172e5',
      reportType: 'Crowd',
      locationDetails: 'KR Market Metro Station',
      severity: 4,
      description: 'Extremely crowded platform during rush hour',
      txHash: '0x7b3c45e9d044f33c719c1b1a0f6e482e9d0638b31d89b2b478f3a0e1a0d31e5b',
    },
    {
      id: 2,
      timestamp: Math.floor(Date.now() / 1000) - 10800, // 3 hours ago
      reporter: '0x9cb2f207662bD543904023756Hbd147d33D183f6',
      reportType: 'Accessibility',
      locationDetails: 'Dwarka Sector 21 Metro',
      severity: 2,
      description: 'Elevator temporarily out of service',
      txHash: '0x8c4d56f0e155g44d830d2c2b1g7f593f0e1749c42e9ac3c589g4b1f2b1e42f6c',
    },
    {
      id: 3,
      timestamp: Math.floor(Date.now() / 1000) - 14400, // 4 hours ago
      reporter: '0xAdc3g318773cE654015134756Icd258e44E194g7',
      reportType: 'Route Change',
      locationDetails: 'Gurgaon Bus Terminal',
      severity: 1,
      description: 'Route 502 temporarily rerouted due to road work',
      txHash: '0x9d5e67g1f266h55e941e3d3c2c8g604g1f2850d53f0bd4d69ah5c2g3c2f53g7d',
    },
    {
      id: 4,
      timestamp: Math.floor(Date.now() / 1000) - 18000, // 5 hours ago
      reporter: '0xBe4dh429884dF765f026245757Jde369f55F205h8',
      reportType: 'Delay',
      locationDetails: 'Noida Sector 18',
      severity: 5,
      description: 'Major delay - Bus breakdown on route',
      txHash: '0xae6f78h2g377i66f052f4e4e3d9h715h2g3961e64g1ce5e7ai6d3h4d3g64h8e',
    },
  ]

  return mockLogs
}

const getSeverityColor = (severity) => {
  if (severity >= 4) return '#dc2626' // Red for high
  if (severity === 3) return '#f59e0b' // Orange for medium
  return '#22c55e' // Green for low
}

const getSeverityLabel = (severity) => {
  if (severity >= 4) return 'High'
  if (severity === 3) return 'Medium'
  return 'Low'
}

const formatAddress = (address) => {
  if (!address) return 'N/A'
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp * 1000)
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const BlockchainLogsPage = () => {
  const { t } = useI18n()
  const [logs, setLogs] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate fetching logs from blockchain
    setIsLoading(true)
    setTimeout(() => {
      const mockLogs = generateMockLogs()
      setLogs(mockLogs)
      setIsLoading(false)
    }, 1000)
  }, [])

  return (
    <div className="blockchain-logs-page">
      <section className="panel-card hero blockchain-hero">
        <div>
          <p className="eyebrow">BLOCKCHAIN LOGS</p>
          <h1>Transit Data Feed</h1>
          <p>Immutable, transparent transit event logs from Sepolia Testnet</p>
          <div className="contract-info">
            <div className="info-item">
              <Link2 size={16} />
              <span>
                Contract: <code>{formatAddress(CONTRACT_ADDRESS)}</code>
              </span>
            </div>
            <div className="info-item">
              <span>Network: Sepolia Testnet</span>
            </div>
          </div>
        </div>
      </section>

      <section className="panel-card logs-section">
        <header className="section-header">
          <div>
            <p className="eyebrow">RECENT LOGS</p>
            <h2>Event Logs</h2>
          </div>
          <span className="meta">{logs.length} reports</span>
        </header>

        {isLoading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Fetching logs from blockchain...</p>
          </div>
        ) : (
          <div className="logs-list">
            {logs.map((log) => (
              <article key={log.id} className="log-card">
                <div className="log-header">
                  <div className="log-type-badge">
                    {log.reportType === 'Delay' && <Clock size={16} />}
                    {log.reportType === 'Crowd' && <AlertCircle size={16} />}
                    {log.reportType === 'Accessibility' && <CheckCircle size={16} />}
                    {log.reportType === 'Route Change' && <MapPin size={16} />}
                    <span>{log.reportType}</span>
                  </div>
                  <div
                    className="severity-badge"
                    style={{ backgroundColor: getSeverityColor(log.severity) }}
                  >
                    {getSeverityLabel(log.severity)}
                  </div>
                </div>

                <div className="log-content">
                  <h3>{log.locationDetails}</h3>
                  <p>{log.description}</p>
                </div>

                <div className="log-meta">
                  <div className="meta-row">
                    <span className="meta-label">Timestamp</span>
                    <span className="meta-value">{formatTimestamp(log.timestamp)}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Reporter</span>
                    <span className="meta-value address">{formatAddress(log.reporter)}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Transaction</span>
                    <a
                      href={`https://sepolia.etherscan.io/tx/${log.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="meta-value link"
                    >
                      {formatAddress(log.txHash)}
                      <Link2 size={12} />
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

