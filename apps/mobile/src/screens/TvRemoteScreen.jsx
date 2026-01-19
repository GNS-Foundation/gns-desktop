import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import './TvRemoteScreen.css';

export function TvRemoteScreen() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [device, setDevice] = useState(null);
    const [hubInfo, setHubInfo] = useState({ url: 'http://192.168.1.100:3500' }); // Mock for now, should come from context/store

    useEffect(() => {
        // Fetch device details
        // Since we don't have a global store yet, we will re-fetch
        fetchDevice();
    }, [id]);

    const fetchDevice = async () => {
        // Mock fetch or call Tauri command if we had "get_device(id)"
        // But our command is get_devices(hub_url), so we filter.
        try {
            const devices = await invoke('get_devices', { hubUrl: hubInfo.url });
            const dev = devices.find(d => d.id === id);
            if (dev) {
                setDevice(dev);
            }
        } catch (e) {
            console.error("Failed to fetch device", e);
            // Fallback mock
            setDevice({
                id: id,
                name: "Living Room TV",
                brand: "Samsung",
                status: { online: true, state: { power: 'on', volume: 15 } }
            });
        }
    };

    const executeCommand = async (action, value = null) => {
        try {
            // Haptic feedback could be triggered here via tauri-plugin-haptics if available
            await invoke('execute_command', {
                hubUrl: hubInfo.url,
                deviceId: id,
                action: action,
                value: value
            });
            console.log(`Command ${action} sent`);
        } catch (e) {
            console.error(`Command ${action} failed`, e);
            alert(`Failed: ${e}`);
        }
    };

    if (!device) return <div className="tv-remote-screen loading">Loading...</div>;

    return (
        <div className="tv-remote-screen">
            <div className="handle-bar"></div>

            <header className="remote-header">
                <div className="device-icon">📺</div>
                <div className="device-info">
                    <h2>{device.name}</h2>
                    <p>{device.brand} • {device.status.online ? 'On' : 'Off'}</p>
                </div>
                <button
                    className={`power-btn ${device.status.state?.power === 'on' ? 'on' : 'off'}`}
                    onClick={() => executeCommand('power', 'toggle')}
                >
                    ⏻
                </button>
            </header>

            <div className="remote-controls">
                {/* Top Row */}
                <div className="top-controls">
                    <ControlButton icon="🏠" label="Home" onClick={() => executeCommand('key', 'home')} />
                    <ControlButton icon="⬅️" label="Back" onClick={() => navigate(-1)} />
                    <ControlButton icon="☰" label="Menu" onClick={() => executeCommand('key', 'menu')} />
                    <ControlButton icon="🔌" label="Input" onClick={() => executeCommand('key', 'source')} />
                </div>

                {/* Main Control Area */}
                <div className="main-controls">
                    {/* Volume */}
                    <div className="volume-control">
                        <span className="label">VOL</span>
                        <button className="long-btn" onClick={() => executeCommand('volume_up')}>+</button>
                        <div className="volume-display">{device.status.state?.volume || '--'}</div>
                        <button className="long-btn" onClick={() => executeCommand('volume_down')}>-</button>
                        <button className="small-btn" onClick={() => executeCommand('mute')}>🔇</button>
                    </div>

                    {/* D-Pad */}
                    <div className="d-pad">
                        <button className="d-up" onClick={() => executeCommand('key', 'up')}>▲</button>
                        <button className="d-left" onClick={() => executeCommand('key', 'left')}>◀</button>
                        <button className="d-center" onClick={() => executeCommand('key', 'enter')}>OK</button>
                        <button className="d-right" onClick={() => executeCommand('key', 'right')}>▶</button>
                        <button className="d-down" onClick={() => executeCommand('key', 'down')}>▼</button>
                    </div>

                    {/* Channel */}
                    <div className="channel-control">
                        <span className="label">CH</span>
                        <button className="long-btn" onClick={() => executeCommand('key', 'channel_up')}>▲</button>
                        <div className="channel-display">CH</div>
                        <button className="long-btn" onClick={() => executeCommand('key', 'channel_down')}>▼</button>
                        <button className="small-btn" onClick={() => executeCommand('key', 'info')}>ℹ️</button>
                    </div>
                </div>

                {/* Media Controls */}
                <div className="media-controls">
                    <MediaButton icon="⏮" onClick={() => executeCommand('key', 'previous')} />
                    <MediaButton icon="⏯" onClick={() => executeCommand('key', 'play_pause')} isPrimary />
                    <MediaButton icon="⏭" onClick={() => executeCommand('key', 'next')} />
                </div>
            </div>
        </div>
    );
}

function ControlButton({ icon, label, onClick }) {
    return (
        <button className="control-btn" onClick={onClick}>
            <span className="icon">{icon}</span>
            <span className="label">{label}</span>
        </button>
    );
}

function MediaButton({ icon, onClick, isPrimary }) {
    return (
        <button className={`media-btn ${isPrimary ? 'primary' : ''}`} onClick={onClick}>
            {icon}
        </button>
    );
}
