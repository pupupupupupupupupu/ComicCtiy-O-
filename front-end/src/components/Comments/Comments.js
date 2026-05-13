import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Link } from "react-router-dom";
import axios from "axios";
import "./Comments.css";

const BASE_URL = `${process.env.REACT_APP_URL}/api/comics`;

const timeAgo = (dateStr) => {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const Avatar = ({ picture, name, userId }) => {
  const inner = picture
    ? <img src={picture} alt={name} className="commentAvatar" />
    : <div className="commentAvatarFallback">{(name || "?")[0].toUpperCase()}</div>;

  return (
    <Link to={`/user/${encodeURIComponent(userId)}`} className="avatarLink" title={`View ${name}'s profile`}>
      {inner}
    </Link>
  );
};

// ── Inline edit form ──────────────────────────────────────────────────────
const EditForm = ({ initialText, onSave, onCancel, maxLength = 2000 }) => {
  const [text, setText] = useState(initialText);
  return (
    <div className="editForm">
      <textarea
        className="commentTextarea small"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={maxLength}
        rows={3}
        autoFocus
      />
      <div className="editFormActions">
        <button className="btn btn-primary smallBtn"
          onClick={() => text.trim() && onSave(text.trim())}
          disabled={!text.trim() || text.trim() === initialText}>
          Save
        </button>
        <button className="smallBtn cancelBtn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
};

// ── Reply form ────────────────────────────────────────────────────────────
const ReplyForm = ({ onSubmit, onCancel }) => {
  const [text, setText] = useState("");
  return (
    <div className="replyForm">
      <textarea className="commentTextarea small" placeholder="Write a reply…"
        value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={1000} />
      <div className="replyFormActions">
        <button className="btn btn-primary smallBtn"
          onClick={() => { if (text.trim()) { onSubmit(text.trim()); setText(""); } }}
          disabled={!text.trim()}>Reply</button>
        <button className="smallBtn cancelBtn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
};

// ── Single reply ──────────────────────────────────────────────────────────
const ReplyItem = ({ reply, replyIndex, currentUser, comicId, commentId, onCommentUpdate }) => {
  const [editing, setEditing] = useState(false);
  const isAuthor = currentUser && currentUser.sub === reply.userId;

  const handleEditSave = async (text) => {
    const res = await axios.patch(
      `${BASE_URL}/${comicId}/comments/${commentId}/reply/${replyIndex}`,
      { userId: currentUser.sub, text }
    );
    onCommentUpdate(res.data);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this reply?")) return;
    const res = await axios.delete(
      `${BASE_URL}/${comicId}/comments/${commentId}/reply/${replyIndex}`,
      { data: { userId: currentUser.sub } }
    );
    onCommentUpdate(res.data);
  };

  return (
    <div className="replyItem">
      <Avatar picture={reply.userPicture} name={reply.userName} userId={reply.userId} />
      <div className="commentBody">
        <div className="commentHeader">
          <Link to={`/user/${encodeURIComponent(reply.userId)}`} className="commentAuthorLink">
            {reply.userName}
          </Link>
          <span className="commentTime">{timeAgo(reply.createdAt)}</span>
          {reply.edited && <span className="editedBadge">edited</span>}
          {isAuthor && !editing && (
            <div className="commentActions authorActions">
              <button className="commentActionBtn" onClick={() => setEditing(true)}>✏️ Edit</button>
              <button className="commentActionBtn danger" onClick={handleDelete}>🗑️</button>
            </div>
          )}
        </div>
        {editing
          ? <EditForm initialText={reply.text} maxLength={1000}
              onSave={handleEditSave} onCancel={() => setEditing(false)} />
          : <p className="commentText">{reply.text}</p>
        }
      </div>
    </div>
  );
};

// ── Single comment ────────────────────────────────────────────────────────
const CommentItem = ({
  comment, currentUser, comicId, comicOwnerEmail,
  ownerAllowance, onCommentUpdate, onCommentDelete, onAllowanceChange,
}) => {
  const [showReplies,   setShowReplies]   = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [editing,       setEditing]       = useState(false);

  const isAuthor = currentUser && currentUser.sub === comment.userId;
  const isOwner  = currentUser && currentUser.email === comicOwnerEmail;
  const replyCount = comment.replies?.length || 0;

  const handleEditSave = async (text) => {
    const res = await axios.patch(`${BASE_URL}/${comicId}/comments/${comment._id}`, {
      userId: currentUser.sub, text,
    });
    onCommentUpdate(res.data);
    setEditing(false);
  };

  const handleAuthorDelete = async () => {
    if (!window.confirm("Delete this comment?")) return;
    await axios.delete(`${BASE_URL}/${comicId}/comments/${comment._id}`, {
      data: { userId: currentUser.sub },
    });
    onCommentDelete(comment._id);
  };

  const handleOwnerHide = async () => {
    if (ownerAllowance.remaining <= 0) return;
    const res = await axios.patch(
      `${BASE_URL}/${comicId}/comments/${comment._id}/hide`,
      { ownerId: currentUser.sub }
    );
    onCommentUpdate(res.data.comment);
    onAllowanceChange({ remaining: res.data.remaining, maxActions: res.data.maxActions });
  };

  const handleOwnerDelete = async () => {
    if (ownerAllowance.remaining <= 0) return;
    if (!window.confirm("Delete this comment as comic owner?")) return;
    const res = await axios.delete(
      `${BASE_URL}/${comicId}/comments/${comment._id}/owner`,
      { data: { ownerId: currentUser.sub } }
    );
    onCommentDelete(comment._id);
    onAllowanceChange({ remaining: res.data.remaining, maxActions: res.data.maxActions });
  };

  const handleReply = async (text) => {
    const res = await axios.post(`${BASE_URL}/${comicId}/comments/${comment._id}/reply`, {
      userId: currentUser.sub,
      userName: currentUser.name || currentUser.email,
      userPicture: currentUser.picture || "",
      text,
    });
    onCommentUpdate(res.data);
    setShowReplies(true);
    setShowReplyForm(false);
  };

  return (
    <div className={`commentItem ${comment.hidden ? "hiddenComment" : ""}`}>
      <Avatar picture={comment.userPicture} name={comment.userName} userId={comment.userId} />
      <div className="commentBody">
        <div className="commentHeader">
          <Link to={`/user/${encodeURIComponent(comment.userId)}`} className="commentAuthorLink">
            {comment.userName}
          </Link>
          <span className="commentTime">{timeAgo(comment.createdAt)}</span>
          {comment.edited && <span className="editedBadge">edited</span>}
          {comment.hidden && <span className="hiddenBadge">hidden</span>}

          {/* Author controls */}
          {isAuthor && !editing && (
            <div className="commentActions authorActions">
              <button className="commentActionBtn" onClick={() => setEditing(true)}>✏️ Edit</button>
              <button className="commentActionBtn danger" onClick={handleAuthorDelete}>🗑️</button>
            </div>
          )}

          {/* Owner controls (when not also the author) */}
          {isOwner && !isAuthor && (
            <div className="commentActions ownerActions">
              <button
                className={`commentActionBtn ${ownerAllowance.remaining <= 0 ? "disabled" : ""}`}
                onClick={handleOwnerHide}
                title={comment.hidden ? "Unhide" : "Hide from readers"}
                disabled={ownerAllowance.remaining <= 0}
              >
                {comment.hidden ? "👁 Show" : "🚫 Hide"}
              </button>
              <button
                className={`commentActionBtn danger ${ownerAllowance.remaining <= 0 ? "disabled" : ""}`}
                onClick={handleOwnerDelete}
                title="Delete (uses 1 action)"
                disabled={ownerAllowance.remaining <= 0}
              >
                🗑️ Del
              </button>
            </div>
          )}
        </div>

        {editing
          ? <EditForm initialText={comment.text} onSave={handleEditSave} onCancel={() => setEditing(false)} />
          : <p className="commentText">{comment.hidden && !isOwner ? "[This comment is hidden]" : comment.text}</p>
        }

        <div className="commentActions">
          {currentUser && (
            <button className="commentActionBtn" onClick={() => setShowReplyForm((v) => !v)}>
              ↩ Reply
            </button>
          )}
          {replyCount > 0 && (
            <button className="commentActionBtn" onClick={() => setShowReplies((v) => !v)}>
              {showReplies ? "Hide replies" : `▸ ${replyCount} repl${replyCount === 1 ? "y" : "ies"}`}
            </button>
          )}
        </div>

        {showReplyForm && (
          <ReplyForm onSubmit={handleReply} onCancel={() => setShowReplyForm(false)} />
        )}

        {showReplies && replyCount > 0 && (
          <div className="repliesList">
            {comment.replies.map((reply, i) => (
              <ReplyItem
                key={i}
                reply={reply}
                replyIndex={i}
                currentUser={currentUser}
                comicId={comicId}
                commentId={comment._id}
                onCommentUpdate={onCommentUpdate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Owner allowance banner ────────────────────────────────────────────────
const AllowanceBanner = ({ allowance }) => {
  if (!allowance.maxActions) return null;
  const pct = allowance.remaining / allowance.maxActions;
  const color = pct > 0.5 ? "#7adb35" : pct > 0.2 ? "#f39c12" : "#e74c3c";
  return (
    <div className="allowanceBanner">
      <span>🛡️ Owner actions today:</span>
      <div className="allowanceBar">
        <div className="allowanceFill" style={{ width: `${pct * 100}%`, background: color }} />
      </div>
      <span style={{ color }} className="allowanceCount">
        {allowance.remaining}/{allowance.maxActions} remaining
      </span>
      <span className="allowanceHint">(resets every 24h)</span>
    </div>
  );
};

// ── Main Comments panel ───────────────────────────────────────────────────
const Comments = ({ comicId, comicOwnerEmail }) => {
  const { user, loginWithRedirect } = useAuth0();
  const [comments,   setComments]   = useState([]);
  const [page,       setPage]       = useState(1);
  const [pagination, setPagination] = useState({});
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newText,    setNewText]    = useState("");
  const [error,      setError]      = useState("");
  const [allowance,  setAllowance]  = useState({ remaining: 0, maxActions: 0 });

  const isOwner = user && user.email === comicOwnerEmail;

  const fetchComments = useCallback(async (p = 1, append = false) => {
    setLoading(!append);
    try {
      const params = { page: p, limit: 15 };
      if (user) { params.requesterId = user.sub; params.requesterEmail = user.email; }
      const res = await axios.get(`${BASE_URL}/${comicId}/comments`, { params });
      setComments((prev) => append ? [...prev, ...res.data.comments] : res.data.comments);
      setPagination(res.data.pagination || {});
    } catch { setError("Couldn't load comments."); }
    finally  { setLoading(false); }
  }, [comicId, user]);

  const fetchAllowance = useCallback(async () => {
    if (!isOwner || !user) return;
    try {
      const res = await axios.get(`${BASE_URL}/${comicId}/comments/allowance`, {
        params: { ownerId: user.sub },
      });
      setAllowance({ remaining: res.data.remaining, maxActions: res.data.maxActions });
    } catch {}
  }, [comicId, user, isOwner]);

  useEffect(() => { fetchComments(1); fetchAllowance(); }, [fetchComments, fetchAllowance]);

  const handlePost = async () => {
    if (!user) return loginWithRedirect({ appState: { returnTo: window.location.pathname } });
    if (!newText.trim()) return;
    setSubmitting(true);
    try {
      const res = await axios.post(`${BASE_URL}/${comicId}/comments`, {
        userId:      user.sub,
        userName:    user.name || user.email,
        userPicture: user.picture || "",
        userEmail:   user.email,
        text:        newText.trim(),
      });
      setComments((prev) => [res.data, ...prev]);
      setNewText("");
    } catch (err) { setError(err.response?.data?.error || "Failed to post."); }
    finally { setSubmitting(false); }
  };

  const updateComment  = (updated) => setComments((p) => p.map((c) => c._id === updated._id ? updated : c));
  const deleteComment  = (id)      => setComments((p) => p.filter((c) => c._id !== id));
  const updateAllowance= (a)       => setAllowance(a);

  const loadMore = () => { const next = page + 1; setPage(next); fetchComments(next, true); };

  return (
    <div className="commentsPanel">
      {isOwner && <AllowanceBanner allowance={allowance} />}

      {user ? (
        <div className="composeBox">
          <Avatar picture={user.picture} name={user.name} userId={user.sub} />
          <div className="composeRight">
            <textarea className="commentTextarea" placeholder="Share your thoughts…"
              value={newText} onChange={(e) => setNewText(e.target.value)} rows={3} maxLength={2000} />
            <div className="composeActions">
              <span className="charCount">{newText.length}/2000</span>
              <button className="btn btn-primary smallBtn" onClick={handlePost}
                disabled={submitting || !newText.trim()}>
                {submitting ? "Posting…" : "Post"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="signInPrompt">
          <button className="inlineSignInBtn"
            onClick={() => loginWithRedirect({ appState: { returnTo: window.location.pathname } })}>
            Sign in
          </button>{" "}to join the conversation.
        </div>
      )}

      {error && <div className="commentError">{error}</div>}

      {loading ? (
        <div className="commentsLoading">{[0,1,2].map((i) => <div key={i} className="commentSkeleton" />)}</div>
      ) : comments.length === 0 ? (
        <div className="noComments"><p>No comments yet. Be the first!</p></div>
      ) : (
        <>
          <div className="commentsList">
            {comments.map((c) => (
              <CommentItem key={c._id} comment={c} currentUser={user}
                comicId={comicId} comicOwnerEmail={comicOwnerEmail}
                ownerAllowance={allowance}
                onCommentUpdate={updateComment}
                onCommentDelete={deleteComment}
                onAllowanceChange={updateAllowance}
              />
            ))}
          </div>
          {pagination.page < pagination.pages && (
            <button className="loadMoreBtn" onClick={loadMore}>Load more comments</button>
          )}
        </>
      )}
    </div>
  );
};

export default Comments;
