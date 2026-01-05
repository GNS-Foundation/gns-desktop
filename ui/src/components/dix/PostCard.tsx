import { DixPost } from '../../types/dix';
import { MessageSquare, Heart, Repeat, Share, MapPin, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface PostCardProps {
    post: DixPost;
    onLike?: (id: string) => void;
    onReply?: (id: string) => void;
    onRepost?: (id: string) => void;
    className?: string;
    onClick?: () => void;
}

export function PostCard({ post, onLike, onReply, onRepost, className, onClick }: PostCardProps) {
    const timeAgo = formatDistanceToNow(new Date(post.meta.createdAt), { addSuffix: true });

    return (
        <div
            className={cn("p-4 border-b border-border bg-card text-card-foreground hover:bg-accent/50 transition-colors", className)}
            onClick={onClick}
        >
            <div className="flex gap-3">
                {/* Avatar */}
                <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                        {(post.author.handle || post.author.publicKey.substring(0, 1)).charAt(0).toUpperCase()}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 text-sm mb-1">
                        <span className="font-semibold truncate">
                            {post.author.handle || truncateKey(post.author.publicKey)}
                        </span>
                        {post.author.handle && <CheckCircle className="w-3 h-3 text-blue-500" />}
                        <span className="text-muted-foreground truncate">
                            {post.author.handle ? `@${post.author.handle}` : ''}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{timeAgo}</span>
                        {post.author.trustScore > 0 && (
                            <>
                                <span className="text-muted-foreground">·</span>
                                <span className="text-green-500 text-xs">Trust {post.author.trustScore}%</span>
                            </>
                        )}
                    </div>

                    {/* Text */}
                    <div className="whitespace-pre-wrap text-[15px] leading-normal break-words">
                        {renderTextWithTags(post.content.text)}
                    </div>

                    {/* Media */}
                    {post.content.media?.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl overflow-hidden border border-border">
                            {post.content.media.map((m, i) => (
                                <div key={i} className={`relative ${post.content.media.length === 1 ? 'col-span-2 aspect-video' : 'aspect-square'}`}>
                                    {m.type === 'image' ? (
                                        <img
                                            src={m.url}
                                            alt={m.alt || 'Post media'}
                                            className="absolute inset-0 w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                                            <span className="text-xs">Video placeholder</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Location */}
                    {post.content.location && (
                        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {post.content.location}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-between mt-3 max-w-md text-muted-foreground">
                        <button
                            onClick={(e) => { e.stopPropagation(); onReply?.(post.id); }}
                            className="flex items-center gap-1 text-sm hover:text-blue-500 transition-colors group"
                        >
                            <div className="p-2 rounded-full group-hover:bg-blue-500/10 -ml-2">
                                <MessageSquare className="w-4 h-4" />
                            </div>
                            <span>{post.engagement.replies || ''}</span>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onRepost?.(post.id); }}
                            className="flex items-center gap-1 text-sm hover:text-green-500 transition-colors group"
                        >
                            <div className="p-2 rounded-full group-hover:bg-green-500/10">
                                <Repeat className="w-4 h-4" />
                            </div>
                            <span>{post.engagement.reposts || ''}</span>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onLike?.(post.id); }}
                            className="flex items-center gap-1 text-sm hover:text-pink-500 transition-colors group"
                        >
                            <div className="p-2 rounded-full group-hover:bg-pink-500/10">
                                <Heart className="w-4 h-4" />
                            </div>
                            <span>{post.engagement.likes || ''}</span>
                        </button>
                        <button
                            className="flex items-center gap-1 text-sm hover:text-blue-500 transition-colors group"
                        >
                            <div className="p-2 rounded-full group-hover:bg-blue-500/10">
                                <Share className="w-4 h-4" />
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function truncateKey(key: string) {
    if (key.length <= 12) return key;
    return `${key.substring(0, 6)}...${key.substring(key.length - 4)}`;
}

function renderTextWithTags(text: string) {
    // Simple regex to split by tags/mentions
    const parts = text.split(/([#@][a-zA-Z0-9_]+)/g);
    return parts.map((part, i) => {
        if (part.startsWith('#') || part.startsWith('@')) {
            return <span key={i} className="text-blue-500 font-medium">{part}</span>;
        }
        return part;
    });
}
