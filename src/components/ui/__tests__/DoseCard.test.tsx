import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DoseCard } from '../DoseCard';

describe('DoseCard (Expandable Accordion Item)', () => {
  it('renders collapsed row with time, medicine name, strength, and primary "Log Taken" action', () => {
    const handleTake = vi.fn();
    render(
      <DoseCard
        medicineName="Metformin"
        strength="500 mg"
        doseAmount="1 tablet"
        scheduledMinutes={480}
        status="pending"
        withFood={true}
        remaining={20}
        onTake={handleTake}
        onOrderRefill={vi.fn()}
        onViewDetails={vi.fn()}
      />
    );

    // Collapsed header elements
    expect(screen.getByText('Metformin')).toBeInTheDocument();
    expect(screen.getByText('500 mg')).toBeInTheDocument();
    expect(screen.getByText('1 tablet')).toBeInTheDocument();
    expect(screen.getByText('08:00 AM')).toBeInTheDocument();

    const logTakenBtn = screen.getByRole('button', { name: /Log Taken/i });
    expect(logTakenBtn).toBeInTheDocument();

    // Drawer elements should not be visible yet
    expect(screen.queryByRole('button', { name: /Order Refill/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /View Details/i })).not.toBeInTheDocument();
  });

  it('clicking the row expands the drawer to reveal "Order Refill", "View Details", and inventory count', () => {
    const handleRefill = vi.fn();
    const handleViewDetails = vi.fn();

    render(
      <DoseCard
        medicineName="Atorvastatin"
        strength="20 mg"
        doseAmount="1 tablet"
        scheduledMinutes={1290}
        status="pending"
        withFood={false}
        remaining={14}
        instructions="Take at bedtime"
        onTake={vi.fn()}
        onOrderRefill={handleRefill}
        onViewDetails={handleViewDetails}
      />
    );

    const row = screen.getByRole('button', { name: /Atorvastatin/i });
    expect(row).toHaveAttribute('aria-expanded', 'false');

    // Click row to expand
    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'true');

    // Secondary components revealed
    expect(screen.getByText(/14 in cabinet inventory/i)).toBeInTheDocument();
    expect(screen.getByText('Take at bedtime')).toBeInTheDocument();

    const refillBtn = screen.getByRole('button', { name: /Order Refill/i });
    const detailsBtn = screen.getByRole('button', { name: /View Details/i });

    expect(refillBtn).toBeInTheDocument();
    expect(detailsBtn).toBeInTheDocument();

    // Test clicking secondary buttons
    fireEvent.click(refillBtn);
    expect(handleRefill).toHaveBeenCalledTimes(1);

    fireEvent.click(detailsBtn);
    expect(handleViewDetails).toHaveBeenCalledTimes(1);
  });

  it('clicking primary "Log Taken" button fires onTake without toggling accordion', () => {
    const handleTake = vi.fn();
    render(
      <DoseCard
        medicineName="Lisinopril"
        strength="10 mg"
        scheduledMinutes={540}
        status="pending"
        onTake={handleTake}
      />
    );

    const row = screen.getByRole('button', { name: /Lisinopril/i });
    const logTakenBtn = screen.getByRole('button', { name: /Log Taken/i });

    fireEvent.click(logTakenBtn);

    expect(handleTake).toHaveBeenCalledTimes(1);
    // Row remains collapsed because stopPropagation was called
    expect(row).toHaveAttribute('aria-expanded', 'false');
  });

  it('displays low stock and out-of-stock warning states when expanded', () => {
    const { rerender } = render(
      <DoseCard
        medicineName="Omeprazole"
        scheduledMinutes={420}
        status="pending"
        remaining={2}
        isExpanded={true}
      />
    );

    expect(screen.getByText(/Low stock: 2 remaining/i)).toBeInTheDocument();

    rerender(
      <DoseCard
        medicineName="Omeprazole"
        scheduledMinutes={420}
        status="pending"
        remaining={0}
        isExpanded={true}
      />
    );

    expect(screen.getByText(/Out of stock \(0 left in cabinet\)/i)).toBeInTheDocument();
  });

  it('supports keyboard Enter and Space navigation to toggle expansion', () => {
    render(
      <DoseCard
        medicineName="Amlodipine"
        strength="5 mg"
        scheduledMinutes={480}
        status="pending"
        remaining={10}
      />
    );

    const row = screen.getByRole('button', { name: /Amlodipine/i });
    expect(row).toHaveAttribute('aria-expanded', 'false');

    // Press Enter
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(row).toHaveAttribute('aria-expanded', 'true');

    // Press Space
    fireEvent.keyDown(row, { key: ' ' });
    expect(row).toHaveAttribute('aria-expanded', 'false');
  });

  it('displays taken state and provides Undo action when expanded', () => {
    const handleUndo = vi.fn();
    render(
      <DoseCard
        medicineName="Metformin"
        strength="500 mg"
        scheduledMinutes={480}
        status="taken"
        remaining={15}
        onUndo={handleUndo}
        isExpanded={true}
      />
    );

    expect(screen.getByText('Logged')).toBeInTheDocument();
    const undoBtn = screen.getByRole('button', { name: /Undo/i });
    expect(undoBtn).toBeInTheDocument();

    fireEvent.click(undoBtn);
    expect(handleUndo).toHaveBeenCalledTimes(1);
  });
});
