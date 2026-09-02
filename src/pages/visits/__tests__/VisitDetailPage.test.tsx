import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { VisitDetailPage } from '../VisitDetailPage';
import * as dbVisits from '../../../lib/db/visits';
import * as dbMedicines from '../../../lib/db/medicines';
import * as dbTestOrders from '../../../lib/db/testOrders';
import * as dbReports from '../../../lib/db/reports';
import type { Tables } from '../../../lib/supabase/types';

// Mock DB repos
vi.mock('../../../lib/db/visits', () => ({
  getVisitById: vi.fn(),
  updateVisit: vi.fn(),
  deleteVisit: vi.fn(),
  listVisitImages: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../lib/db/medicines', () => ({
  listMedicines: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../lib/db/testOrders', () => ({
  listTestOrders: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../lib/db/reports', () => ({
  listReports: vi.fn().mockResolvedValue([]),
}));

// Mock Auth
vi.mock('../../../lib/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-123' },
    profile: { id: 'profile-123', user_id: 'user-123', full_name: 'Test Patient' },
  }),
}));

const mockVisit = {
  id: 'visit-1',
  user_id: 'user-123',
  profile_id: 'profile-123',
  doctor_name: 'Farooq Rehman',
  clinic_name: 'South City Hospital',
  specialty: 'Cardiology',
  visit_date: '2025-04-10',
  diagnosis: 'Hypertension Stage 1',
  doctor_advice: 'Reduce dietary sodium, walk 30 mins daily, repeat BP in 2 weeks',
  follow_up_date: '2025-04-24',
  visit_cost: 3500,
  currency: 'PKR',
  notes: 'Patient reported occasional morning headaches',
  created_at: '2025-04-10T10:00:00Z',
  updated_at: '2025-04-10T10:00:00Z',
};

const mockMedicines = [
  {
    id: 'med-1',
    user_id: 'user-123',
    profile_id: 'profile-123',
    visit_id: 'visit-1',
    medicine_name: 'Amlodipine',
    strength: '5mg',
    form: 'Tablet',
    dose_amount: '1 tablet',
    frequency_code: 'OD',
    instructions: 'Take in the morning with water',
    with_food: true,
    is_ongoing: true,
    duration_days: null,
    start_date: '2025-04-10',
    end_date: null,
    is_otc: false,
    unit_cost: 200,
    currency: 'PKR',
    created_at: '2025-04-10T10:00:00Z',
    updated_at: '2025-04-10T10:00:00Z',
  },
];

const mockTestOrders = [
  {
    id: 'order-1',
    user_id: 'user-123',
    profile_id: 'profile-123',
    visit_id: 'visit-1',
    test_name: 'Lipid Profile',
    status: 'pending',
    ordered_date: '2025-04-10',
    report_id: null,
    currency: 'PKR',
    created_at: '2025-04-10T10:00:00Z',
    updated_at: '2025-04-10T10:00:00Z',
  },
];

describe('VisitDetailPage', () => {
  beforeEach(() => {
    vi.mocked(dbVisits.getVisitById).mockImplementation(async (id) => {
      if (id === 'visit-1') return mockVisit as unknown as Tables<'visits'>;
      return null;
    });
    vi.mocked(dbVisits.updateVisit).mockImplementation(async (_id, updates) => ({
      ...mockVisit,
      ...updates,
    } as unknown as Tables<'visits'>));
    vi.mocked(dbVisits.deleteVisit).mockResolvedValue(undefined);
    vi.mocked(dbVisits.listVisitImages).mockResolvedValue([]);
    vi.mocked(dbReports.listReports).mockResolvedValue([]);
    vi.mocked(dbMedicines.listMedicines).mockResolvedValue(mockMedicines as unknown as Tables<'medicines'>[]);
    vi.mocked(dbTestOrders.listTestOrders).mockResolvedValue(mockTestOrders as unknown as Tables<'test_orders'>[]);
  });

  it('renders the complete visit details with doctor advice, medicines, and test orders', async () => {
    render(
      <MemoryRouter initialEntries={['/visits/visit-1']}>
        <Routes>
          <Route path="/visits/:id" element={<VisitDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Dr. Farooq Rehman')[0]).toBeInTheDocument();
      expect(screen.getAllByText('South City Hospital')[0]).toBeInTheDocument();
      expect(screen.getByText('Cardiology')).toBeInTheDocument();
      expect(screen.getByText('Hypertension Stage 1')).toBeInTheDocument();
      expect(
        screen.getByText('Reduce dietary sodium, walk 30 mins daily, repeat BP in 2 weeks')
      ).toBeInTheDocument();
      expect(screen.getByText('Amlodipine')).toBeInTheDocument();
      expect(screen.getByText('Lipid Profile')).toBeInTheDocument();
    });
  });

  it('opens and submits the edit consultation modal', async () => {
    vi.mocked(dbVisits.getVisitById).mockResolvedValue(mockVisit as unknown as Tables<'visits'>);
    vi.mocked(dbVisits.updateVisit).mockResolvedValue({
      ...mockVisit,
      diagnosis: 'Controlled Hypertension',
    } as unknown as Tables<'visits'>);

    render(
      <MemoryRouter initialEntries={['/visits/visit-1']}>
        <Routes>
          <Route path="/visits/:id" element={<VisitDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Dr. Farooq Rehman')[0]).toBeInTheDocument();
    });

    // Click Edit button
    const editBtn = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Edit Consultation Record')).toBeInTheDocument();

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /save consultation/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(dbVisits.updateVisit).toHaveBeenCalledWith(
        'visit-1',
        expect.objectContaining({
          doctor_name: 'Farooq Rehman',
          clinic_name: 'South City Hospital',
        })
      );
    });
  });

  it('renders not found state when visit does not exist', async () => {
    vi.mocked(dbVisits.getVisitById).mockResolvedValue(null);

    render(
      <MemoryRouter initialEntries={['/visits/non-existent']}>
        <Routes>
          <Route path="/visits/:id" element={<VisitDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Consultation Not Found')).toBeInTheDocument();
      expect(screen.getByText(/Back to Medical Timeline/i)).toBeInTheDocument();
    });
  });
});
