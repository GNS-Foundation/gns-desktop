import { invoke } from '@tauri-apps/api/core';
import { DixPost, DixMedia, DixPostData, DixUserData } from '../types/dix';

export const DixApi = {
    createPost: async (text: string, media: DixMedia[] = [], replyToId?: string): Promise<DixPost> => {
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

    likePost: async (id: string): Promise<void> => {
        return invoke('like_post', { id });
    },

    repostPost: async (id: string): Promise<void> => {
        return invoke('repost_post', { id });
    },

    getPost: async (id: string): Promise<DixPostData> => {
        return invoke<DixPostData>('get_post', { id });
    },

    getUserPosts: async (publicKey: string): Promise<DixUserData> => {
        return invoke<DixUserData>('get_posts_by_user', { publicKey });
    }
};
