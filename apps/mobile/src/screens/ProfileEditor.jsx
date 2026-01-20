import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Using react-router-dom instead of wouter for MobileApp consistency
import { useIdentity } from '../hooks/useIdentity';
import './ProfileEditor.css';

export function ProfileEditor() {
    const navigate = useNavigate();
    const { identity, updateProfile } = useIdentity();

    const [name, setName] = useState('');
    const [bio, setBio] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [saving, setSaving] = useState(false);

    // Load initial data
    useEffect(() => {
        if (identity) {
            setName(identity.displayName || identity.name || ''); // Fallback to identity name
            setBio(identity.bio || '');
            setAvatarUrl(identity.avatarUrl || '');
        }
    }, [identity]);

    const handleSave = async () => {
        if (!name.trim()) {
            alert('Display name is required');
            return;
        }

        setSaving(true);
        try {
            const result = await updateProfile({
                displayName: name.trim(),
                bio: bio.trim(),
                avatarUrl: avatarUrl.trim(),
                // Links and location settings deferred for now
            });

            if (result.success) {
                navigate(-1); // Go back
            } else {
                alert('Failed to save profile: ' + result.error);
            }
        } catch (e) {
            alert('Error saving profile: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    // Simple prompt for avatar URL for now (future: image picker)
    const handleAvatarClick = () => {
        const url = prompt('Enter Avatar URL:', avatarUrl);
        if (url !== null) {
            setAvatarUrl(url);
        }
    };

    return (
        <div className="profile-editor">
            <header className="editor-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    ← Cancel
                </button>
                <h2>Edit Profile</h2>
                <button
                    className="save-btn"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? 'Saving...' : 'Save'}
                </button>
            </header>

            <div className="editor-content">
                <div className="avatar-section">
                    <div className="avatar-wrapper" onClick={handleAvatarClick}>
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar" className="avatar-preview" />
                        ) : (
                            <div className="avatar-placeholder">👤</div>
                        )}
                        <div className="camera-badge">📷</div>
                    </div>
                    <span className="change-photo-text">Tap to change photo URL</span>
                </div>

                <div className="form-group">
                    <label className="form-label">Display Name</label>
                    <input
                        type="text"
                        className="form-input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your Name"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Bio</label>
                    <textarea
                        className="form-textarea"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell us about yourself"
                        rows={3}
                    />
                </div>

                {/* Future: Links and Location Privacy settings */}
            </div>
        </div>
    );
}
