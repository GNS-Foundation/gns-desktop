import React from 'react';
import './FloatingActionButtons.css';

export function FloatingActionButtons({ onSendMoney, onNewMessage }) {
    return (
        <div className="fab-container">
            <button
                className="fab fab-send-money"
                onClick={onSendMoney}
                title="Send Money"
            >
                💰
            </button>

            <button
                className="fab fab-new-message"
                onClick={onNewMessage}
                title="New Message"
            >
                ✏️
            </button>
        </div>
    );
}
