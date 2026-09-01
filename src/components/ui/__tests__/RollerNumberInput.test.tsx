import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RollerNumberInput } from '../RollerNumberInput';

describe('RollerNumberInput', () => {
  it('renders with initial value, label and unit', () => {
    render(
      <RollerNumberInput
        value={120}
        onChange={() => {}}
        label="Systolic"
        unit="mmHg"
      />
    );

    expect(screen.getByText('Systolic')).toBeInTheDocument();
    expect(screen.getByText('mmHg')).toBeInTheDocument();
    expect(screen.getByDisplayValue('120')).toBeInTheDocument();
  });

  it('increments and decrements with nudge buttons', () => {
    const handleChange = vi.fn();
    render(
      <RollerNumberInput
        value={120}
        onChange={handleChange}
        min={50}
        max={200}
        step={1}
        label="Systolic"
      />
    );

    const increaseBtn = screen.getByLabelText('Increase Systolic');
    fireEvent.click(increaseBtn);
    expect(handleChange).toHaveBeenCalledWith(121);

    const decreaseBtn = screen.getByLabelText('Decrease Systolic');
    fireEvent.click(decreaseBtn);
    expect(handleChange).toHaveBeenCalledWith(119);
  });

  it('handles direct typing into the input box', () => {
    const handleChange = vi.fn();
    render(
      <RollerNumberInput
        value={100}
        onChange={handleChange}
        min={30}
        max={400}
        step={1}
      />
    );

    const input = screen.getByDisplayValue('100');
    fireEvent.change(input, { target: { value: '145' } });
    expect(handleChange).toHaveBeenCalledWith(145);
  });

  it('handles keyboard ArrowUp and ArrowDown navigation', () => {
    const handleChange = vi.fn();
    render(
      <RollerNumberInput
        value={80}
        onChange={handleChange}
        min={40}
        max={140}
        step={1}
      />
    );

    const input = screen.getByDisplayValue('80');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(handleChange).toHaveBeenCalledWith(81);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(handleChange).toHaveBeenCalledWith(79);
  });
});
