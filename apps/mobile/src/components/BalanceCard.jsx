import React from 'react';
import './BalanceCard.css';

export function BalanceCard({ balances }) {
    return (
        <div className="balance-card">
            <h3>Your Balances</h3>

            <div className="balance-row">
                <div className="balance-item">
                    <span className="amount">€{(balances.gns_balance || 0).toFixed(2)}</span>
                    <span className="currency">EURC</span>
                </div>

                <div className="divider"></div>

                <div className="balance-item">
                    <span className="amount">${(balances.xlm_balance || 0).toFixed(2)}</span>
                    <span className="currency">XLM</span>
                    {/* Note: Flutter showed USDC, but get_stellar_balances returns XLM/GNS. 
                        We should update Rust to return stablecoins if parity is strict, 
                        or map GNS->EURC. For now showing XLM as secondary. */}
                </div>
            </div>

            {!balances.account_exists && (
                <div className="activation-warning">
                    ⚠️ Account not active
                </div>
            )}
        </div>
    );
}
