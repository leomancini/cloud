import React, { useCallback } from "react";
import { useReactionDoubleTap } from "../hooks/useDoubleTap.js";

export function PostItemWithReaction({ post, getReactionEmojis, onReact, renderContent }) {
  const handleReact = useCallback((e) => {
    const touch = e?.changedTouches?.[0];
    const syntheticEvent = { clientX: touch?.clientX || e?.clientX, clientY: touch?.clientY || e?.clientY, target: e?.target };
    onReact(post.id, getReactionEmojis("posts")[0], syntheticEvent);
  }, [post.id, onReact, getReactionEmojis]);

  const reactProps = useReactionDoubleTap(handleReact);
  return renderContent(reactProps);
}

export function CommentRowWithReaction({ postId, commentId, onReact, renderContent }) {
  const handleReact = useCallback((e) => {
    const touch = e?.changedTouches?.[0];
    onReact(postId, commentId, { clientX: touch?.clientX || e?.clientX, clientY: touch?.clientY || e?.clientY, target: e?.target }, null);
  }, [postId, commentId, onReact]);

  const reactProps = useReactionDoubleTap(handleReact);
  return renderContent(reactProps);
}
