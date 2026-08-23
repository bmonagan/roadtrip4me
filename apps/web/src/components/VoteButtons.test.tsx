import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StopWithUserVote } from '@roadtrip4me/types';
import VoteButtons from './VoteButtons';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    votes: { cast: vi.fn(), remove: vi.fn() },
  },
}));

const stop: StopWithUserVote = {
  id: 'stop_1',
  name: 'Blue Hole',
  description: null,
  coordinates: { lat: 34.87, lng: -104.6 },
  address: { street: null, city: 'Santa Rosa', state: 'NM', country: 'US', postalCode: null },
  category: 'viewpoint',
  imageUrl: null,
  externalId: null,
  score: 5,
  voteCount: 3,
  submittedByUserId: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  userVote: null,
};

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('VoteButtons', () => {
  beforeEach(() => {
    vi.mocked(api.votes.cast).mockResolvedValue({
      ...stop,
      userVote: 1,
    });
    vi.mocked(api.votes.remove).mockResolvedValue(undefined);
  });

  it('renders the current score', () => {
    renderWithQuery(<VoteButtons stop={stop} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('(3)')).toBeInTheDocument();
  });

  it('casts an upvote on click', async () => {
    renderWithQuery(<VoteButtons stop={stop} />);
    fireEvent.click(screen.getByLabelText('Upvote'));
    await waitFor(() => expect(api.votes.cast).toHaveBeenCalledWith('stop_1', 1));
  });

  it('casts a downvote on click', async () => {
    renderWithQuery(<VoteButtons stop={stop} />);
    fireEvent.click(screen.getByLabelText('Downvote'));
    await waitFor(() => expect(api.votes.cast).toHaveBeenCalledWith('stop_1', -1));
  });
});
