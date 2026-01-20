import React, { useEffect } from 'react';
import { useDix } from '../hooks/useDix';
import './DixTimelineScreen.css';

export function DixTimelineScreen() {
    const { timeline, loading, getTimeline, createPost, likePost } = useDix();
    const [newPostText, setNewPostText] = React.useState('');

    useEffect(() => {
        getTimeline();
    }, [getTimeline]);

    const handlePost = async () => {
        if (!newPostText.trim()) return;
        try {
            await createPost(newPostText);
            setNewPostText('');
        } catch (e) {
            alert(e.message);
        }
    };

    return (
        <div className="dix-screen">
            <div className="compose-area">
                <textarea
                    placeholder="What's happening?"
                    value={newPostText}
                    onChange={e => setNewPostText(e.target.value)}
                />
                <button onClick={handlePost} disabled={!newPostText.trim()}>Post</button>
            </div>

            <div className="timeline">
                {loading && timeline.length === 0 && <div className="loading">Loading...</div>}

                {timeline.map(post => (
                    <div key={post.id} className="dix-post">
                        <div className="post-header">
                            <span className="author">@{post.author.handle || 'anon'}</span>
                            <span className="time">{new Date(post.meta.created_at).toLocaleTimeString()}</span>
                        </div>
                        <div className="post-content">
                            {post.content.text}
                        </div>
                        <div className="post-actions">
                            <button onClick={() => likePost(post.id)}>
                                ❤️ {post.engagement.likes}
                            </button>
                            <button>💬 {post.engagement.replies}</button>
                            <button>🔄 {post.engagement.reposts}</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
