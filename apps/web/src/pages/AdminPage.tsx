import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { api, ApiError, type AdminUserView } from '../lib/api';
import { useToast } from '../lib/useToast';
import LoadingBanner from '../components/LoadingBanner';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export default function AdminPage() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.users.me(),
    enabled: isAuthenticated,
  });

  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['users/admin', page],
    queryFn: () => api.users.admin.list({ page, pageSize: 50 }),
    enabled: isAuthenticated && !!me?.isAdmin,
  });

  const update = useMutation({
    mutationFn: (args: { id: string; body: { isPremium?: boolean; isAdmin?: boolean } }) =>
      api.users.admin.update(args.id, args.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users/admin'] });
      toast({ message: 'User updated', type: 'success' });
    },
    onError: (e) => toast({ message: (e as ApiError).message, type: 'error' }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.users.admin.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users/admin'] });
      toast({ message: 'User deleted', type: 'success' });
    },
    onError: (e) => toast({ message: (e as ApiError).message, type: 'error' }),
  });

  const togglePremium = (u: AdminUserView) =>
    update.mutate({ id: u.id, body: { isPremium: !u.isPremium } });

  const toggleAdmin = (u: AdminUserView) =>
    update.mutate({ id: u.id, body: { isAdmin: !u.isAdmin } });

  const confirmDelete = (u: AdminUserView) => {
    if (window.confirm(`Delete ${u.email}? This cannot be undone.`)) {
      remove.mutate(u.id);
    }
  };

  if (!isAuthenticated) return <p className="muted">Log in to manage users.</p>;
  if (me && !me.isAdmin) return <p className="error">Admin privileges required.</p>;

  if (isLoading) return <LoadingBanner message="Loading users…" />;
  if (isError) return <p className="error">{(error as Error).message}</p>;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Admin</h1>
        <p className="muted">Manage accounts and grant premium for testing.</p>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Email</th>
            <th>Joined</th>
            <th>Premium</th>
            <th>Admin</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(data?.data ?? []).map((u) => (
            <tr key={u.id}>
              <td>{u.displayName}</td>
              <td>{u.email}</td>
              <td>{formatDate(u.createdAt)}</td>
              <td>
                <span className={`badge ${u.isPremium ? 'premium' : ''}`}>
                  {u.isPremium ? '⭐ Premium' : 'Free'}
                </span>
              </td>
              <td>
                {u.isAdmin ? (
                  <span className="badge">Admin</span>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td>
                <div className="admin-actions">
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => togglePremium(u)}
                    disabled={update.isPending}
                  >
                    {u.isPremium ? 'Revoke premium' : 'Grant premium'}
                  </button>
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => toggleAdmin(u)}
                    disabled={update.isPending || u.id === me?.id}
                  >
                    {u.isAdmin ? 'Remove admin' : 'Make admin'}
                  </button>
                  <button
                    type="button"
                    className="btn small danger"
                    onClick={() => confirmDelete(u)}
                    disabled={remove.isPending || u.id === me?.id}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {data && (
        <div className="pagination">
          <button
            type="button"
            className="btn small"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            ← Prev
          </button>
          <span className="muted">
            Page {data.page} of {Math.max(1, Math.ceil(data.total / data.pageSize))}
          </span>
          <button
            type="button"
            className="btn small"
            onClick={() => setPage((p) => p + 1)}
            disabled={!data.hasNextPage}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
