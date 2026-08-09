import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Stop } from '@roadtrip4me/types';
import { api } from '../lib/api';

export default function VoteButtons({ stop }: { stop: Stop }) {
  const queryClient = useQueryClient();
  const [userVote, setUserVote] = useState<1 | -1 | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['stops'] });

  const cast = useMutation({
    mutationFn: (value: 1 | -1) => api.votes.cast(stop.id, value),
    onSuccess: (updated) => {
      setUserVote(updated.userVote);
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: () => api.votes.remove(stop.id),
    onSuccess: () => {
      setUserVote(null);
      invalidate();
    },
  });

  const upActive = userVote === 1;
  const downActive = userVote === -1;

  return (
    <div className="vote-buttons">
      <button
        type="button"
        className={`vote-btn${upActive ? ' active-up' : ''}`}
        aria-label="Upvote"
        onClick={() => (upActive ? remove.mutate() : cast.mutate(1))}
        disabled={cast.isPending || remove.isPending}
      >
        ▲
      </button>
      <span
        className={`vote-score${stop.score > 0 ? ' positive' : stop.score < 0 ? ' negative' : ''}`}
      >
        {stop.score}
      </span>
      <button
        type="button"
        className={`vote-btn${downActive ? ' active-down' : ''}`}
        aria-label="Downvote"
        onClick={() => (downActive ? remove.mutate() : cast.mutate(-1))}
        disabled={cast.isPending || remove.isPending}
      >
        ▼
      </button>
      <span className="muted vote-count">({stop.voteCount})</span>
    </div>
  );
}
