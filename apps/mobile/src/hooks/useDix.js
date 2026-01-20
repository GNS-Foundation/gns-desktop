import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function useDix() {
    const [timeline, setTimeline] = useState([]);
    const [loading, setLoading] = useState(false);
    const [posting, setPosting] = useState(false);
    const [error, setError] = useState(null);

    const getTimeline = useCallback(async (limit = 20, offset = 0) => {
        try {
            setLoading(true);
            const res = await invoke('get_timeline', { limit, offset });
            if (offset === 0) {
                setTimeline(res);
            } else {
                setTimeline(prev => [...prev, ...res]);
            }
            setError(null);
            return res;
        } catch (e) {
            console.error('Failed to get timeline:', e);
            setError(e.toString());
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const createPost = async (text, media = []) => {
        try {
            setPosting(true);
            const res = await invoke('create_post', {
                text,
                media,
                replyToId: null
            });

            // Add to timeline immediately
            setTimeline(prev => [res, ...prev]);
            return res;
        } catch (e) {
            console.error('Failed to create post:', e);
            throw e;
        } finally {
            setPosting(false);
        }
    };

    const likePost = async (id) => {
        try {
            await invoke('like_post', { id });
            // Optimistically update UI
            setTimeline(prev => prev.map(post => {
                if (post.id === id) {
                    return {
                        ...post,
                        engagement: {
                            ...post.engagement,
                            likes: post.engagement.likes + 1
                        },
                        // We might want to track 'isLiked' state if backend provides it
                    };
                }
                return post;
            }));
        } catch (e) {
            console.error('Failed to like post:', e);
            // Revert?
        }
    };

    return {
        timeline,
        loading,
        posting,
        error,
        getTimeline,
        createPost,
        likePost
    };
}
