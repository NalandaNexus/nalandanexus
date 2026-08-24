import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  MessageSquare,
  Trophy,
  Heart,
  Send,
  LogIn,
} from 'lucide-react';
import { playTone } from '../utils/sound';
import { useAuth } from '../context/AuthContext';
import { studentApiService } from '../services/studentApiService';
import { getSocket } from '../services/socket';

function timeAgoShort(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function Community() {
  const { user, isAuthenticated } = useAuth();

  const [posts, setPosts] = useState([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState('');
  const [newPostText, setNewPostText] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);

  const loadFeed = useCallback(async () => {
    setIsLoadingPosts(true);
    setPostsError('');
    try {
      const { posts: fetched } = await studentApiService.getCommunityPosts({ limit: 20 });
      setPosts(fetched);
    } catch (err) {
      setPostsError(err.message || 'Unable to load the community feed.');
    } finally {
      setIsLoadingPosts(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadFeed();
    setIsLoadingLeaderboard(true);
    // Leaderboards are course-scoped now - this widget shows the student's
    // primary (first) enrolled course rather than a platform-wide ranking.
    studentApiService
      .getCourses()
      .then((courses) => {
        const primarySlug = courses?.[0]?.slug;
        if (!primarySlug) return { entries: [] };
        return studentApiService.getLeaderboard(primarySlug, 'thisWeek');
      })
      .then((data) => setLeaderboard(data.entries || []))
      .catch(() => setLeaderboard([]))
      .finally(() => setIsLoadingLeaderboard(false));
  }, [isAuthenticated, loadFeed]);

  // Real-time: another student's new post or like updates this feed live -
  // previously the only content-creation path in the app with no sync at
  // all (community.controller.js now emits on create/like).
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const socket = getSocket();
    if (!socket) return undefined;

    const handleCreated = (post) => {
      setPosts((prev) => (prev.some((p) => p.id === post.id) ? prev : [post, ...prev]));
    };
    const handleUpdated = ({ id, likesCount }) => {
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, likesCount } : p)));
    };

    socket.on('community.post_created', handleCreated);
    socket.on('community.post_updated', handleUpdated);
    return () => {
      socket.off('community.post_created', handleCreated);
      socket.off('community.post_updated', handleUpdated);
    };
  }, [isAuthenticated]);

  const handlePost = async (e) => {
    e.preventDefault();
    if (!newPostText.trim() || isPosting) return;
    playTone(640, 'sine', 0.05, 0.03);

    setIsPosting(true);
    try {
      const saved = await studentApiService.createCommunityPost(newPostText.trim());
      setPosts((prev) => [saved, ...prev]);
      setNewPostText('');
    } catch (err) {
      setPostsError(err.message || 'Could not share your post. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  const handleLikePost = async (postId) => {
    playTone(600, 'sine', 0.04, 0.02);
    // Optimistic toggle - reconciled with the server response right after.
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, likedByMe: !p.likedByMe, likesCount: p.likesCount + (p.likedByMe ? -1 : 1) }
          : p
      )
    );
    try {
      const updated = await studentApiService.toggleCommunityPostLike(postId);
      setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
    } catch {
      loadFeed();
    }
  };

  return (
    <div className="min-h-screen pt-28 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-300 text-xs font-semibold mb-4">
          <Users className="w-3.5 h-3.5" />
          <span>GLOBAL LEARNER NETWORK</span>
        </div>
        <h1 className="font-heading font-extrabold text-4xl sm:text-5xl text-slate-900 dark:text-white tracking-tight">
          Nalanda Nexus Community
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mt-3 leading-relaxed font-medium">
          Connect with fellow learners, share project breakthroughs, and celebrate each other's progress.
        </p>
      </div>

      {!isAuthenticated ? (
        <div className="max-w-xl mx-auto p-8 rounded-3xl bg-white/95 dark:bg-[#0D1424]/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/15 shadow-xl text-center space-y-4">
          <LogIn className="w-8 h-8 mx-auto text-purple-600 dark:text-purple-400" />
          <h2 className="font-heading font-bold text-lg text-slate-900 dark:text-white">
            Log in to join the conversation
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            The community feed and leaderboard are available to enrolled Nalanda Nexus students.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all"
          >
            <span>Log in</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left / Center: Feed & Discussions */}
          <div className="lg:col-span-8 space-y-6">
            {/* Create Post Card */}
            <div className="p-6 rounded-3xl bg-white/95 dark:bg-[#0D1424]/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/15 shadow-xl shadow-slate-200/50 dark:shadow-2xl">
              <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Share an update with your cohort</span>
              </h3>
              <form onSubmit={handlePost} className="space-y-3">
                <textarea
                  value={newPostText}
                  onChange={(e) => setNewPostText(e.target.value)}
                  placeholder="What are you building or learning today? Share insights, questions, or project links..."
                  rows={3}
                  disabled={isPosting}
                  className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm outline-none focus:border-purple-400 resize-none transition-colors disabled:opacity-60"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!newPostText.trim() || isPosting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isPosting ? 'Posting…' : 'Post Update'}</span>
                  </button>
                </div>
              </form>
            </div>

            {postsError && <p className="text-xs font-semibold text-rose-500">{postsError}</p>}

            {/* Posts List */}
            {isLoadingPosts ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">Loading feed…</div>
            ) : posts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 rounded-3xl bg-white/95 dark:bg-[#0D1424]/80 border border-slate-200/90 dark:border-white/15">
                No posts yet. Be the first to share something with your cohort!
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 rounded-3xl bg-white/95 dark:bg-[#0D1424]/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-2xl space-y-4"
                  >
                    {/* Author Info */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-600/15 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-sm border border-purple-500/40">
                        {post.author.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                          {post.author.id === user?._id ? 'You' : post.author.name}
                        </h4>
                        <span className="text-xs text-purple-700 dark:text-purple-300 block -mt-0.5 font-medium">
                          {timeAgoShort(post.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                      {post.body}
                    </p>

                    {/* Actions */}
                    <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex items-center gap-6 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                      <button
                        onClick={() => handleLikePost(post.id)}
                        className={`flex items-center gap-1.5 hover:text-rose-500 transition-colors ${
                          post.likedByMe ? 'text-rose-500 font-bold' : ''
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${post.likedByMe ? 'fill-rose-500' : ''}`} />
                        <span>{post.likesCount} Likes</span>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Leaderboard & Upcoming Hackathons */}
          <div className="lg:col-span-4 space-y-6">
            {/* Top Creators Leaderboard - real data from GET /api/leaderboard */}
            <div className="p-6 rounded-3xl bg-white/95 dark:bg-[#0D1424]/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/15 shadow-xl shadow-slate-200/50 dark:shadow-2xl">
              <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>This Week's Top Learners</span>
              </h3>

              {isLoadingLeaderboard ? (
                <div className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">Loading…</div>
              ) : leaderboard.length === 0 ? (
                <div className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                  No activity yet this week.
                </div>
              ) : (
                <div className="space-y-3">
                  {leaderboard.slice(0, 5).map((c) => (
                    <div
                      key={c.userId}
                      className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-slate-500 dark:text-slate-400">#{c.rank}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{c.name}</span>
                      </div>
                      <span className="font-mono text-cyan-700 dark:text-cyan-400 font-bold">{c.points} XP</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
