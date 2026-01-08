import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DixApi } from '../lib/dix';
import { PostCard } from '../components/dix/PostCard';
import { Loader2, ArrowLeft } from 'lucide-react';

export function PostDetailPage() {
    const { postId } = useParams<{ postId: string }>();
    const navigate = useNavigate();
    const [replyText, setReplyText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['dix-post', postId],
        queryFn: () => DixApi.getPost(postId!),
        enabled: !!postId,
    });

    const handleReply = async () => {
        if (!replyText.trim() || !postId) return;
        setIsSubmitting(true);
        try {
            await DixApi.createPost(replyText, [], postId);
            setReplyText('');
            refetch();
        } catch (e) {
            console.error('Failed to reply:', e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleLike = async (id: string) => {
        try {
            await DixApi.likePost(id);
            refetch();
        } catch (e) {
            console.error("Like failed", e);
        }
    };

    const handleRepost = async (id: string) => {
        try {
            await DixApi.repostPost(id);
            refetch();
        } catch (e) {
            console.error("Repost failed", e);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                Loading conversation...
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-8 text-center text-red-400">
                Failed to load post. It may have been deleted.
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-950">
            {/* Header */}
            <div className="flex items-center gap-4 p-4 border-b border-border bg-surface/50 backdrop-blur sticky top-0 z-10">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-xl font-bold">Post</h1>
            </div>

            <div className="flex-1 overflow-y-auto pb-20">
                {/* Main Post */}
                <div className="border-b border-border bg-surface/20">
                    <PostCard
                        post={data.post}
                        onLike={handleLike}
                        onRepost={handleRepost}
                        onReply={() => document.getElementById('reply-input')?.focus()}
                        className="text-lg p-6" // Make main post slightly larger
                    />
                </div>

                {/* Reply Input */}
                <div className="p-4 border-b border-border bg-surface/10">
                    <textarea
                        id="reply-input"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Post your reply"
                        className="w-full bg-transparent text-base resize-none border-none focus:ring-0 placeholder:text-slate-500 min-h-[60px] p-0"
                        rows={2}
                    />
                    <div className="flex justify-end mt-2">
                        <button
                            onClick={handleReply}
                            disabled={!replyText.trim() || isSubmitting}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-full font-bold text-sm"
                        >
                            {isSubmitting ? 'Replying...' : 'Reply'}
                        </button>
                    </div>
                </div>

                {/* Replies */}
                <div className="flex flex-col">
                    {data.replies.map((reply) => (
                        <PostCard
                            key={reply.id}
                            post={reply}
                            onLike={handleLike}
                            onRepost={handleRepost}
                            onReply={() => navigate(`/dix/post/${reply.id}`)}
                            className="hover:bg-surface/30 pl-8 border-l-2 border-border ml-4 my-1"
                        />
                    ))}
                    {data.replies.length === 0 && (
                        <div className="p-8 text-center text-slate-600 italic">
                            No replies yet.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
