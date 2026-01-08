import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DixApi } from '../lib/dix';
import { PostCard } from '../components/dix/PostCard';
import { Loader2, X } from 'lucide-react';

export function DixTimeline() {
    const navigate = useNavigate();
    const [composeText, setComposeText] = useState('');
    const [replyToId, setReplyToId] = useState<string | null>(null);
    const [replyToAuthor, setReplyToAuthor] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: posts, isLoading, refetch } = useQuery({
        queryKey: ['dix-timeline'],
        queryFn: () => DixApi.getTimeline(20, 0),
        refetchInterval: 30000,
    });

    const handlePost = async () => {
        if (!composeText.trim()) return;

        setIsSubmitting(true);
        try {
            await DixApi.createPost(composeText, [], replyToId || undefined);
            setComposeText('');
            setReplyToId(null);
            setReplyToAuthor(null);
            refetch();
        } catch (e) {
            console.error('Failed to post:', e);
            alert('Failed to post: ' + String(e));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReply = (id: string, authorHandle: string) => {
        setReplyToId(id);
        setReplyToAuthor(authorHandle);
        // Scroll to compose box or focus it
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelReply = () => {
        setReplyToId(null);
        setReplyToAuthor(null);
    };

    const handleLike = async (id: string) => {
        try {
            await DixApi.likePost(id);
            refetch();
        } catch (e) {
            console.error('Failed to like:', e);
        }
    };

    const handleRepost = async (id: string) => {
        try {
            await DixApi.repostPost(id);
            refetch();
        } catch (e) {
            console.error('Failed to repost:', e);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-950">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-surface/50 backdrop-blur sticky top-0 z-10">
                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    Dix@
                </h1>
                <button
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    onClick={() => refetch()}
                >
                    <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {/* Compose Box */}
                <div className="p-4 border-b border-border bg-surface/30">
                    {/* ✅ Reply indicator */}
                    {replyToId && (
                        <div className="flex items-center justify-between bg-indigo-900/30 border border-indigo-500/30 rounded-lg px-3 py-2 mb-3">
                            <span className="text-sm text-indigo-300">
                                Replying to <span className="font-semibold">@{replyToAuthor}</span>
                            </span>
                            <button onClick={cancelReply} className="text-indigo-400 hover:text-white">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shrink-0">
                            ?
                        </div>
                        <div className="flex-1">
                            <div className="bg-slate-950/50 border border-white/10 rounded-2xl p-3 focus-within:border-indigo-500/50 focus-within:bg-slate-950 transition-colors">
                                <textarea
                                    value={composeText}
                                    onChange={(e) => setComposeText(e.target.value)}
                                    placeholder={replyToId ? "Write your reply..." : "What's happening?"}
                                    className="w-full bg-transparent text-base resize-none border-none focus:ring-0 placeholder:text-slate-500 min-h-[80px] p-0"
                                    rows={3}
                                />
                                <div className="flex justify-between items-center pt-2 border-t border-white/5 mt-2">
                                    <div className="text-xs text-slate-500">
                                        {composeText.length > 0 && `${composeText.length} chars`}
                                    </div>
                                    <button
                                        onClick={handlePost}
                                        disabled={!composeText.trim() || isSubmitting}
                                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white px-5 py-2 rounded-full font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-indigo-900/20"
                                    >
                                        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {replyToId ? 'Reply' : 'Post'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Timeline */}
                {isLoading && !posts ? (
                    <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                        <Loader2 className="w-8 h-8 animate-spin mb-2" />
                        Loading feed...
                    </div>
                ) : (
                    <div className="pb-20">
                        {posts?.map((post) => (
                            <PostCard
                                key={post.id}
                                post={post}
                                onLike={handleLike}
                                onRepost={handleRepost}
                                onReply={(id) => handleReply(id, post.author.handle || 'unknown')}  // ✅ FIXED!
                                onClick={() => navigate(`/dix/post/${post.id}`)}
                                className="hover:bg-surface/50"
                            />
                        ))}

                        {!posts?.length && (
                            <div className="p-12 text-center text-slate-500">
                                No posts yet. Be the first to say something!
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
