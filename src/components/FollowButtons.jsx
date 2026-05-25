import React from "react";
import { Spinner } from "./Spinner.jsx";
import { FollowButton, PeopleFollowButton } from "../styles/people.js";

export const FollowBtn = ({ user, onFollow, busy }) => {
  const status = user.follow_status;
  const following = user.is_following;
  const followsYou = user.follows_you;
  const label = status === "pending" ? "Cancel request to follow" : following ? "Unfollow" : followsYou ? "Follow back" : "Follow";
  return (
    <FollowButton
      $following={!!following}
      $status={status}
      disabled={busy}
      onClick={() => onFollow(user.id, status || (following ? "approved" : null))}
    >
      {busy ? <Spinner /> : label}
    </FollowButton>
  );
};

export const PeopleFollowBtn = ({ user, onFollow, busy }) => {
  const status = user.follow_status;
  const following = user.is_following;
  const followsYou = user.follows_you;
  const label = status === "pending" ? "Cancel request to follow" : following ? "Unfollow" : followsYou ? "Follow back" : "Follow";
  return (
    <PeopleFollowButton
      $following={!!following}
      $status={status}
      disabled={busy}
      onClick={() => onFollow(user.id, status || (following ? "approved" : null))}
    >
      {busy ? <Spinner /> : label}
    </PeopleFollowButton>
  );
};
