import { invoke } from '@tauri-apps/api/core';
import { DixPost, DixMedia, DixPostData, DixUserData } from '../types/dix';
import { isTauriApp } from './tauri';

export const DixApi = {
    createPost: async (text: string, media: DixMedia[] = [], replyToId?: string): Promise<DixPost> => {
        console.log('[DixApi] createPost called with:', { text, media, replyToId });
        return invoke<DixPost>('create_post', {
            text,
            media,
            reply_to_id: replyToId
        });
    },

    getTimeline: async (limit: number = 20, offset: number = 0): Promise<DixPost[]> => {
        return invoke<DixPost[]>('get_timeline', {
            limit,
            offset
        });
    },

    getPost: async (id: string): Promise<DixPostData> => {
        return invoke<DixPostData>('get_post', { id });
    },

    getUserPosts: async (publicKey: string): Promise<DixUserData> => {
        return invoke<DixUserData>('get_posts_by_user', { publicKey });
    },

    likePost: async (id: string): Promise<void> => {
        if (isTauriApp()) {
            return invoke('like_post', { id });
        }
        // TODO: Web implementation via fetch/API
        console.warn('likePost not implemented on web yet');
    },

    repostPost: async (id: string): Promise<void> => {
        if (isTauriApp()) {
            return invoke('repost_post', { id });
        }
        // TODO: Web implementation
        console.warn('repostPost not implemented on web yet');
    }
};
