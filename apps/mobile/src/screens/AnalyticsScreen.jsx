import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { useAnalytics } from '../hooks/useAnalytics';
import './AnalyticsScreen.css';

export function AnalyticsScreen() {
    const navigate = useNavigate();
    const { loading, data, period, setPeriod } = useAnalytics();
    const [activeTab, setActiveTab] = useState('overview');

    if (loading) {
        return (
            <div className="analytics-screen">
                <header className="analytics-header">
                    <div className="analytics-nav">
                        <button className="analytics-back-btn" onClick={() => navigate(-1)}>←</button>
                        <h2 className="analytics-title">Analytics</h2>
                        <div style={{ width: 40 }} />
                    </div>
                </header>
                <div className="analytics-loading">Loading insights...</div>
            </div>
        );
    }

    if (!data) {
        return <div className="analytics-screen">No data available</div>;
    }

    return (
        <div className="analytics-screen">
            <header className="analytics-header">
                <div className="analytics-nav">
                    <button className="analytics-back-btn" onClick={() => navigate(-1)}>←</button>
                    <h2 className="analytics-title">Analytics</h2>
                    <select
                        className="analytics-period-selector"
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                    >
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="year">This Year</option>
                    </select>
                </div>

                <div className="analytics-tabs">
                    {['overview', 'categories', 'budgets', 'goals'].map(tab => (
                        <button
                            key={tab}
                            className={`analytics-tab ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
            </header>

            <div className="analytics-content">
                {activeTab === 'overview' && <OverviewTab data={data} />}
                {activeTab === 'categories' && <CategoriesTab data={data} />}
                {activeTab === 'budgets' && <BudgetsTab budgets={data.budgets} />}
                {activeTab === 'goals' && <GoalsTab goals={data.goals} />}
            </div>
        </div>
    );
}

function OverviewTab({ data }) {
    const { summary, dailyData } = data;

    return (
        <>
            <div className="summary-cards-row">
                <div className="summary-card">
                    <div className="sc-title">⬆️ Spent</div>
                    <div className="sc-value negative">${summary.totalSpent.toFixed(2)}</div>
                </div>
                <div className="summary-card">
                    <div className="sc-title">⬇️ Received</div>
                    <div className="sc-value positive">${summary.totalReceived.toFixed(2)}</div>
                </div>
            </div>

            <div className="summary-cards-row">
                <div className="summary-card">
                    <div className="sc-title">📊 Net Flow</div>
                    <div className={`sc-value ${summary.netFlow >= 0 ? 'positive' : 'negative'}`}>
                        {summary.netFlow >= 0 ? '+' : ''}${summary.netFlow.toFixed(2)}
                    </div>
                </div>
                <div className="summary-card">
                    <div className="sc-title">🧾 Transactions</div>
                    <div className="sc-value">{summary.totalTx}</div>
                </div>
            </div>

            <div className="chart-container">
                <div className="chart-title">Spending Trend</div>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyData}>
                        <defs>
                            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6c5ce7" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#6c5ce7" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="date" hide />
                        <YAxis hide />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#333', border: 'none', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                        />
                        <Area type="monotone" dataKey="amount" stroke="#6c5ce7" fillOpacity={1} fill="url(#colorAmount)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </>
    );
}

function CategoriesTab({ data }) {
    return (
        <>
            <div className="chart-container" style={{ height: 300 }}>
                <div className="chart-title">Breakdown</div>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data.categories}
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {data.categories.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>

            {data.categories.map((cat, i) => (
                <div className="category-item" key={i}>
                    <div className="cat-icon" style={{ color: cat.color }}>
                        {cat.name.charAt(0)}
                    </div>
                    <div className="cat-details">
                        <div className="cat-name">{cat.name}</div>
                        <div className="cat-bar-bg">
                            <div
                                className="cat-bar-fill"
                                style={{ width: `${(cat.value / data.summary.totalSpent * 100)}%`, backgroundColor: cat.color }}
                            />
                        </div>
                    </div>
                    <div className="cat-amount">${cat.value.toFixed(2)}</div>
                </div>
            ))}
        </>
    );
}

function BudgetsTab({ budgets }) {
    return (
        <>
            {budgets.map((b) => {
                const percent = (b.spent / b.limit) * 100;
                const isOver = percent > 100;

                return (
                    <div className="budget-card" key={b.id}>
                        <div className="budget-header">
                            <span style={{ fontWeight: 'bold' }}>{b.name}</span>
                            {isOver && <span className="budget-status">Over Budget</span>}
                        </div>

                        <div className="budget-amounts">
                            <span className="budget-spent">${b.spent.toFixed(0)}</span>
                            <span className="budget-limit">of ${b.limit}</span>
                        </div>

                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: isOver ? '#e74c3c' : b.color }}
                            />
                        </div>

                        <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                            {percent.toFixed(0)}% used • ${Math.max(b.limit - b.spent, 0).toFixed(0)} left
                        </div>
                    </div>
                );
            })}
            <button style={{ width: '100%', padding: 16, border: '1px dashed #444', background: 'none', color: '#888', borderRadius: 8 }}>
                + Create New Budget
            </button>
        </>
    );
}

function GoalsTab({ goals }) {
    return (
        <>
            {goals.map((g) => {
                const percent = (g.current / g.target) * 100;
                return (
                    <div className="goal-card" key={g.id}>
                        <div className="goal-emoji">{g.emoji}</div>
                        <div className="goal-info">
                            <div className="goal-name">{g.name}</div>
                            <div className="budget-amounts">
                                <span className="budget-spent">${g.current}</span>
                                <span className="budget-limit">target ${g.target}</span>
                            </div>
                            <div className="progress-bar">
                                <div className="progress-fill" style={{ width: `${percent}%`, backgroundColor: '#2ecc71' }} />
                            </div>
                        </div>
                    </div>
                );
            })}
            <button style={{ width: '100%', padding: 16, border: '1px dashed #444', background: 'none', color: '#888', borderRadius: 8 }}>
                + Create New Savings Goal
            </button>
        </>
    );
}
