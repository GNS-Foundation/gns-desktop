import React from 'react';
import './SegmentedControl.css';

export function SegmentedControl({ tabs, activeTab, onTabChange }) {
    return (
        <div className="segmented-control">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    className={`segment ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => onTabChange(tab.id)}
                >
                    {tab.icon && <span className="segment-icon">{tab.icon}</span>}
                    <span className="segment-label">{tab.label}</span>
                    {tab.badge > 0 && (
                        <span className="segment-badge">{tab.badge}</span>
                    )}
                </button>
            ))}
        </div>
    );
}
