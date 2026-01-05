export interface DixPost {
    id: string;
    author: DixPostAuthor;
    facet: string;
    content: DixPostContent;
    engagement: DixPostEngagement;
    meta: DixPostMeta;
    thread?: DixPostThread;
}

export interface DixPostAuthor {
    publicKey: string;
    handle?: string;
    displayName?: string;
    avatarUrl?: string;
    trustScore: number;
    breadcrumbCount: number;
    isVerified: boolean;
}

export interface DixPostContent {
    text: string;
    tags: string[];
    mentions: string[];
    media: DixMedia[];
    links: DixLink[];
    location?: string;
}

export interface DixPostEngagement {
    likes: number;
    replies: number;
    reposts: number;
    quotes: number;
    views: number;
}

export interface DixPostMeta {
    signature: string;
    trustScoreAtPost: number;
    breadcrumbsAtPost: number;
    createdAt: string;
}

export interface DixPostThread {
    replyToId?: string;
    quoteOfId?: string;
}

export interface DixMedia {
    type: 'image' | 'video';
    url: string;
    alt?: string;
}

export interface DixLink {
    url: string;
    title?: string;
    image?: string;
}
export interface DixPostData {
    post: DixPost;
    replies: DixPost[];
    replyCount: number;
}
export interface DixUserData {
    user: DixPostAuthor;
    posts: DixPost[];
}
