// ============================================================================
// GNS-TAURI - Wallet Card Component
// ============================================================================
// React component showing wallet balance and actions.
// 
// Usage:
//   <WalletCard gnsPublicKey="26b9c6a8..." secretKey="..." />
// ============================================================================

import { useState } from 'react';
import {
  useStellar,
  useSendGns,
  useCreateGnsTrustline,
  useClaimBalance,
  useFriendbotFund,
  getExplorerAccountUrl,
  getExplorerTxUrl,
} from '../../hooks/useStellar';

interface WalletCardProps {
  gnsPublicKey: string;
  secretKey: string; // Hex encoded Ed25519 secret key
}

export function WalletCard({ gnsPublicKey, secretKey }: WalletCardProps) {
  const {
    stellarAddress,
    xlmBalance,
    gnsBalance,
    claimableGns,
    hasTrustline,
    isFunded,
    isMainnet,
    loading,
    error,
    refetchBalance,
  } = useStellar();

  const { send: sendGns, sending: sendingGns, result: sendResult } = useSendGns();
  const { create: createTrustline, creating: creatingTrustline } = useCreateGnsTrustline();
  const { claim: claimStart, claiming } = useClaimBalance();
  const { fund: friendbotFund, funding } = useFriendbotFund();

  // Local state for send form
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');

  // Handle send GNS
  const handleSend = async () => {
    if (!recipient || !amount) return;

    const result = await sendGns(gnsPublicKey, secretKey, recipient, amount, memo || undefined);

    if (result?.success) {
      // Clear form and refresh balance
      setRecipient('');
      setAmount('');
      setMemo('');
      refetchBalance();
    }
  };

  // Handle create trustline
  const handleCreateTrustline = async () => {
    const result = await createTrustline(gnsPublicKey, secretKey);
    if (result?.success) {
      refetchBalance();
    }
  };

  // Handle friendbot fund (testnet only)
  const handleFriendbotFund = async () => {
    if (stellarAddress) {
      const success = await friendbotFund(stellarAddress);
      if (success) {
        refetchBalance();
      }
    }
  };

  // Handle claim
  const handleClaim = async () => {
    const result = await claimStart();
    if (result?.success) {
      refetchBalance();
    }
  };

  // Open explorer
  const openExplorer = async () => {
    if (stellarAddress) {
      const url = await getExplorerAccountUrl(stellarAddress, !isMainnet);
      window.open(url, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="wallet-card loading">
        <div className="spinner">Loading wallet...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wallet-card error">
        <h3>Wallet Error</h3>
        <p>{error}</p>
        <button onClick={refetchBalance}>Retry</button>
      </div>
    );
  }

  return (
    <div className="wallet-card">
      {/* Header */}
      <div className="wallet-header">
        <h3>💰 GNS Wallet</h3>
        <span className={`network-badge ${isMainnet ? 'mainnet' : 'testnet'}`}>
          {isMainnet ? '🌐 Mainnet' : '🧪 Testnet'}
        </span>
      </div>

      {/* Address */}
      <div className="wallet-address">
        <label>Stellar Address</label>
        <div className="address-row">
          <code>{stellarAddress?.slice(0, 12)}...{stellarAddress?.slice(-8)}</code>
          <button onClick={() => navigator.clipboard.writeText(stellarAddress || '')}>
            📋 Copy
          </button>
          <button onClick={openExplorer}>🔗 Explorer</button>
        </div>
      </div>

      {/* Balances */}
      <div className="wallet-balances">
        <div className="balance-item">
          <span className="balance-label">XLM</span>
          <span className="balance-value">{xlmBalance.toFixed(4)}</span>
        </div>

        <div className="balance-item">
          <span className="balance-label">GNS</span>
          <span className="balance-value">{gnsBalance.toFixed(2)}</span>
          {!hasTrustline && (
            <span className="badge warning">No trustline</span>
          )}
        </div>

        {claimableGns > 0 && (
          <div className="balance-item claimable">
            <span className="balance-label">🎁 Claimable GNS</span>
            <span className="balance-value">{claimableGns.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="wallet-actions">
        {/* Fund button (testnet only) */}
        {!isMainnet && !isFunded && (
          <button
            className="action-btn primary"
            onClick={handleFriendbotFund}
            disabled={funding}
          >
            {funding ? '⏳ Funding...' : '💧 Fund with Friendbot'}
          </button>
        )}

        {/* Create trustline button */}
        {isFunded && !hasTrustline && (
          <button
            className="action-btn secondary"
            onClick={handleCreateTrustline}
            disabled={creatingTrustline}
          >
            {creatingTrustline ? '⏳ Creating...' : '🔗 Create GNS Trustline'}
          </button>
        )}

        {/* Refresh button */}
        <button className="action-btn" onClick={refetchBalance}>
          🔄 Refresh
        </button>
      </div>

      {/* Send Form */}
      {isFunded && hasTrustline && (
        <div className="send-form">
          <h4>Send GNS</h4>

          <div className="form-field">
            <label>Recipient (Stellar address or @handle)</label>
            <input
              type="text"
              placeholder="GXXX... or @username"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Amount</label>
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.01"
            />
            <span className="max-btn" onClick={() => setAmount(gnsBalance.toString())}>
              MAX
            </span>
          </div>

          <div className="form-field">
            <label>Memo (optional)</label>
            <input
              type="text"
              placeholder="Payment memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              maxLength={28}
            />
          </div>

          <button
            className="action-btn primary"
            onClick={handleSend}
            disabled={sendingGns || !recipient || !amount}
          >
            {sendingGns ? '⏳ Sending...' : '📤 Send GNS'}
          </button>

          {/* Send result */}
          {sendResult && (
            <div className={`send-result ${sendResult.success ? 'success' : 'error'}`}>
              {sendResult.success ? (
                <>
                  <p>✅ Transaction sent!</p>
                  {sendResult.hash && (
                    <button
                      className="text-blue-400 hover:underline bg-transparent border-0 p-0 text-sm"
                      onClick={async () => {
                        const url = await getExplorerTxUrl(sendResult.hash!, !isMainnet);
                        window.open(url, '_blank');
                      }}
                    >
                      View on Explorer
                    </button>
                  )}
                </>
              ) : (
                <p>❌ {sendResult.error}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Claimable balances */}
      {claimableGns > 0 && (
        <div className="claimable-section">
          <h4>🎁 Claimable Tokens</h4>
          <p>You have {claimableGns.toFixed(2)} GNS waiting to be claimed!</p>
          <button
            className="action-btn primary"
            onClick={handleClaim}
            disabled={claiming || !hasTrustline}
          >
            {claiming ? '⏳ Claiming...' : hasTrustline ? '🎉 Claim GNS' : 'Create trustline first'}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// STYLES (would normally be in CSS file)
// ============================================================================

export const WalletCardStyles = `
.wallet-card {
  background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 16px;
  padding: 24px;
  color: white;
  max-width: 400px;
  font-family: system-ui, -apple-system, sans-serif;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.wallet-card.loading,
.wallet-card.error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.wallet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.wallet-header h3 {
  margin: 0;
  font-size: 20px;
}

.network-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.network-badge.mainnet {
  background: rgba(76, 175, 80, 0.2);
  color: #4caf50;
}

.network-badge.testnet {
  background: rgba(255, 152, 0, 0.2);
  color: #ff9800;
}

.wallet-address {
  margin-bottom: 20px;
}

.wallet-address label {
  font-size: 12px;
  color: #888;
  display: block;
  margin-bottom: 4px;
}

.address-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.address-row code {
  flex: 1;
  font-size: 14px;
  color: #00d4ff;
}

.wallet-balances {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
}

.balance-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.balance-item:not(:last-child) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.balance-label {
  color: #888;
}

.balance-value {
  font-size: 20px;
  font-weight: 700;
}

.balance-item.claimable .balance-value {
  color: #ffd700;
}

.badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 8px;
}

.badge.warning {
  background: rgba(255, 152, 0, 0.2);
  color: #ff9800;
}

.wallet-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.action-btn {
  padding: 10px 16px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.action-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.primary {
  background: linear-gradient(135deg, #00d4ff 0%, #0099ff 100%);
}

.action-btn.primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #00e5ff 0%, #00aaff 100%);
}

.action-btn.secondary {
  background: linear-gradient(135deg, #ff9800 0%, #ff5722 100%);
}

.send-form {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 20px;
}

.send-form h4 {
  margin: 0 0 16px 0;
}

.form-field {
  margin-bottom: 12px;
  position: relative;
}

.form-field label {
  font-size: 12px;
  color: #888;
  display: block;
  margin-bottom: 4px;
}

.form-field input {
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  color: white;
  font-size: 14px;
  box-sizing: border-box;
}

.form-field input:focus {
  outline: none;
  border-color: #00d4ff;
}

.max-btn {
  position: absolute;
  right: 8px;
  top: 28px;
  padding: 4px 8px;
  background: rgba(0, 212, 255, 0.2);
  color: #00d4ff;
  border-radius: 4px;
  font-size: 10px;
  cursor: pointer;
}

.send-result {
  margin-top: 12px;
  padding: 12px;
  border-radius: 8px;
}

.send-result.success {
  background: rgba(76, 175, 80, 0.2);
}

.send-result.error {
  background: rgba(244, 67, 54, 0.2);
}

.send-result a {
  color: #00d4ff;
}

.claimable-section {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 20px;
  margin-top: 20px;
}

.claimable-section h4 {
  margin: 0 0 8px 0;
}

.spinner {
  color: #888;
}
`;

export default WalletCard;
