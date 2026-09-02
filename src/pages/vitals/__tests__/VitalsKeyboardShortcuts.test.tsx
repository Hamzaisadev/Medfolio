import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VitalsTrackerPage } from '../VitalsTrackerPage';
import * as dbVitals from '../../../lib/db/vitals';

// Mock DB vitals
vi.mock('../../../lib/db/vitals', () => ({
  listGlucoseReadings: vi.fn().mockResolvedValue([]),
  createGlucoseReading: vi.fn().mockResolvedValue({ id: 'g-1' }),
  deleteGlucoseReading: vi.fn().mockResolvedValue(true),
  listBloodPressureReadings: vi.fn().mockResolvedValue([]),
  createBloodPressureReading: vi.fn().mockResolvedValue({ id: 'bp-1' }),
  deleteBloodPressureReading: vi.fn().mockResolvedValue(true),
}));

// Mock Auth
vi.mock('../../../lib/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-123' },
    profile: { id: 'profile-123', user_id: 'user-123' },
  }),
}));

describe('VitalsTrackerPage Keyboard Navigation & Shortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the Blood Glucose modal when pressing "L" or "N"', async () => {
    render(
      <MemoryRouter>
        <VitalsTrackerPage />
      </MemoryRouter>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Press 'l'
    fireEvent.keyDown(window, { key: 'l' });

    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByText('Log Blood Glucose')).toBeInTheDocument();
    });
  });

  it('switches to Blood Pressure tab on "B" and opens BP modal on "N"', async () => {
    render(
      <MemoryRouter>
        <VitalsTrackerPage />
      </MemoryRouter>
    );

    // Switch to BP tab via 'b'
    fireEvent.keyDown(window, { key: 'b' });

    // Press 'n' to open modal
    fireEvent.keyDown(window, { key: 'n' });

    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByText('Log Blood Pressure')).toBeInTheDocument();
    });
  });

  it('submits glucose form when pressing Enter inside the form', async () => {
    render(
      <MemoryRouter>
        <VitalsTrackerPage />
      </MemoryRouter>
    );

    // Open Glucose modal via shortcut 'l'
    fireEvent.keyDown(window, { key: 'l' });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Enter number into notes or hit enter in the form
    const notesInput = screen.getByPlaceholderText('e.g. 2 hours after breakfast');
    fireEvent.change(notesInput, { target: { value: 'Post lunch walk' } });

    // Press Enter to submit
    fireEvent.keyDown(notesInput, { key: 'Enter' });

    await waitFor(() => {
      expect(dbVitals.createGlucoseReading).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          profile_id: 'profile-123',
          value_mg_dl: 100,
          notes: 'Post lunch walk',
        })
      );
    });
  });

  it('submits blood pressure form when pressing Enter inside the form', async () => {
    render(
      <MemoryRouter>
        <VitalsTrackerPage />
      </MemoryRouter>
    );

    // Switch to BP tab and open modal
    fireEvent.keyDown(window, { key: 'b' });
    fireEvent.keyDown(window, { key: 'l' });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const notesInput = screen.getByPlaceholderText('e.g. Morning reading before coffee');
    fireEvent.change(notesInput, { target: { value: 'Before coffee' } });

    // Press Enter to submit
    fireEvent.keyDown(notesInput, { key: 'Enter' });

    await waitFor(() => {
      expect(dbVitals.createBloodPressureReading).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          profile_id: 'profile-123',
          systolic: 120,
          diastolic: 80,
          notes: 'Before coffee',
        })
      );
    });
  });
});

