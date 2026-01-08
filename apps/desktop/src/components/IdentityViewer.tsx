/**
 * Identity Viewer - View another user's identity
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Copy, Check, ExternalLink } from 'lucide-react';
import { resolveHandle, HandleInfo } from '../lib/tauri';
import { DixApi } from '../lib/dix';
import { PostCard } from './dix/PostCard';
import { useQuery } from '@tanstack/react-query';

export function IdentityViewer() {
  const { handle, publicKey } = useParams<{ handle?: string; publicKey?: string }>();
  const navigate = useNavigate();
  const [identity, setIdentity] = useState<HandleInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'posts'>('profile');

  useEffect(() => {
    loadIdentity();
  }, [handle, publicKey]);

  const loadIdentity = async () => {
    try {
      setLoading(true);
      setError(null);

      if (handle) {
        const info = await resolveHandle(handle);
        if (info) {
          setIdentity(info);
        } else {
          setError('Handle not found');
        }
      } else if (publicKey) {
        // For now, just display the public key
        // In a real app, we'd fetch more details
        setIdentity({
          handle: '',
          public_key: publicKey,
          encryption_key: '',
          is_verified: false,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load identity');
    } finally {
      setLoading(false);
    }
  };

  const { data: dixData, isLoading: postsLoading } = useQuery({
    queryKey: ['dix-user-posts', identity?.public_key],
    queryFn: () => DixApi.getUserPosts(identity!.public_key),
    enabled: activeTab === 'posts' && !!identity?.public_key,
  });

  const handleCopy = async () => {
    if (identity?.public_key) {
      await navigator.clipboard.writeText(identity.public_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleMessage = () => {
    if (identity) {
      navigate(`/messages/new?recipient=${identity.public_key}`);
    }
  };

  const handleLike = async (id: string) => {
    try { await DixApi.likePost(id); } catch (e) { }
  };

  const handleRepost = async (id: string) => {
    try { await DixApi.repostPost(id); } catch (e) { }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !identity) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="p-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
            <span className="text-3xl">❓</span>
          </div>
          <h2 className="text-xl font-bold mb-2">Not Found</h2>
          <p className="text-slate-400 text-center">
            {error || 'This identity does not exist'}
          </p>
        </div>
      </div>
    );
  }

  const displayName = identity.handle
    ? `@${identity.handle}`
    : `${identity.public_key.slice(0, 16)}...`;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="p-4 flex items-center gap-4 sticky top-0 bg-background z-10">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">Identity</h1>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-white/10 px-4 mb-4">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-3 font-medium border-b-2 transition-colors ${activeTab === 'profile' ? 'text-indigo-400 border-indigo-400' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab('posts')}
          className={`px-4 py-3 font-medium border-b-2 transition-colors ${activeTab === 'posts' ? 'text-indigo-400 border-indigo-400' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
        >
          Dix@ Posts
        </button>
      </div>

      {activeTab === 'profile' ? (
        <div className="p-6 pt-2">
          <div className="card p-6 text-center">
            {/* Avatar */}
            <div className="avatar avatar-lg mx-auto mb-4 bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-3xl font-bold rounded-full w-24 h-24">
              {identity.handle?.[0]?.toUpperCase() || '?'}
            </div>

            {/* Name */}
            <h2 className="text-2xl font-bold mb-1">{displayName}</h2>

            {identity.display_name && (
              <p className="text-slate-400 mb-2">{identity.display_name}</p>
            )}

            {/* Verified Badge */}
            {identity.is_verified && (
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm mb-4">
                <Check className="w-4 h-4" />
                Verified
              </div>
            )}

            {/* Public Key */}
            <div className="bg-surface/50 rounded-lg p-3 flex items-center gap-3 mb-6 border border-border">
              <p className="font-mono text-xs text-slate-400 truncate flex-1">
                {identity.public_key}
              </p>
              <button
                onClick={handleCopy}
                className="p-2 rounded hover:bg-slate-700/50 transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleMessage}
                className="btn btn-primary flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                Message
              </button>
              {identity.handle && (
                <button
                  onClick={() => {/* Open gSite */ }}
                  className="btn btn-secondary flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <ExternalLink className="w-5 h-5" />
                  gSite
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="pb-20">
          {postsLoading ? (
            <div className="text-center p-12 text-slate-500 flex flex-col items-center">
              <div className="w-6 h-6 border-2 border-slate-700 border-t-indigo-500 rounded-full animate-spin mb-2" />
              Loading posts...
            </div>
          ) : (
            <div className="flex flex-col">
              {dixData?.posts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  onLike={handleLike}
                  onRepost={handleRepost}
                  onClick={() => navigate(`/dix/post/${post.id}`)}
                  className="bg-transparent hover:bg-slate-800/50 border-b border-white/5"
                />
              ))}
              {(!dixData?.posts || dixData.posts.length === 0) && (
                <div className="text-center p-12 text-slate-500 bg-surface/30 m-4 rounded-xl border border-border border-dashed">
                  No posts to show
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
