import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EventDetailModal from '../EventDetailModal';
import type { LeaveRequestWithProfile } from '@/types';

const base: LeaveRequestWithProfile = {
  id: 'req-1',
  profileId: 'user-1',
  startDate: '2026-07-06T00:00:00.000Z',
  endDate: '2026-07-10T00:00:00.000Z',
  daysCount: 5,
  status: 'REQUESTED',
  rejectionReason: null,
  createdAt: '2026-06-01T10:00:00.000Z',
  profile: { id: 'user-1', email: 'ana@lexi.hr', fullName: 'Ana Anić' },
};

function setup(overrides: Partial<LeaveRequestWithProfile> = {}) {
  const onClose = vi.fn();
  const onChanged = vi.fn().mockResolvedValue(undefined);
  const onNotify = vi.fn();
  render(
    <EventDetailModal
      request={{ ...base, ...overrides }}
      onClose={onClose}
      onChanged={onChanged}
      onNotify={onNotify}
    />
  );
  return { onClose, onChanged, onNotify };
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
  global.fetch = fetchMock as never;
});

describe('EventDetailModal', () => {
  it('renders name, status and details', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Ana Anić' })).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('ana@lexi.hr')).toBeInTheDocument();
    expect(screen.getByText(/5 business days/)).toBeInTheDocument();
  });

  it('shows all four actions for REQUESTED', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel leave' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reschedule' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('hides Approve for APPROVED', () => {
    setup({ status: 'APPROVED' });
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cancel leave' })).toBeInTheDocument();
  });

  it('hides Cancel for CANCELLED but shows Approve', () => {
    setup({ status: 'CANCELLED' });
    expect(screen.queryByRole('button', { name: 'Cancel leave' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });

  it('approve sends PATCH, asks parent to refetch, then closes', async () => {
    const { onChanged, onNotify, onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/requests/req-1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'APPROVED' }) })
    );
    expect(onChanged).toHaveBeenCalled();
    expect(onNotify).toHaveBeenCalledWith('success', expect.any(String));
  });

  it('delete requires a confirmation step, then closes', async () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/requests/req-1',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('reschedule save is disabled until dates change, then PATCHes dates', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Reschedule' }));
    const save = screen.getByRole('button', { name: 'Save new dates' });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-07-13' } });
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-07-15' } });
    expect(screen.getByText(/Business days: 3/)).toBeInTheDocument();
    expect(save).toBeEnabled();

    fireEvent.click(save);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/requests/req-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ startDate: '2026-07-13', endDate: '2026-07-15' }),
        })
      )
    );
  });

  it('cancel sends CANCELLED with trimmed optional reason', async () => {
    setup({ status: 'APPROVED' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel leave' }));
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: '  busy  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/requests/req-1',
        expect.objectContaining({
          body: JSON.stringify({ status: 'CANCELLED', rejectionReason: 'busy' }),
        })
      )
    );
  });

  it('shows a 400 error inline and does not refetch', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Nope' }) });
    const { onChanged, onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Nope');
    expect(onChanged).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('on 409 shows the error, refetches, and stays open', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Changed elsewhere' }),
    });
    const { onChanged, onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Changed elsewhere');
    expect(onChanged).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('survives a non-JSON error body', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('x');
      },
    });
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Something went wrong/);
  });

  it('focuses the dialog on open', () => {
    setup();
    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('Escape closes the modal', () => {
    const { onClose } = setup();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('backdrop click closes; click inside the dialog does not', () => {
    const { onClose } = setup();
    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.parentElement as HTMLElement;

    fireEvent.mouseDown(dialog);
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('warns when approved leave already ended', () => {
    setup({
      status: 'APPROVED',
      startDate: '2020-03-02T00:00:00.000Z',
      endDate: '2020-03-06T00:00:00.000Z',
    });
    expect(screen.getByText(/already been taken/)).toBeInTheDocument();
  });
});
