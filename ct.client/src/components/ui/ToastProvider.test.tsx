import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from './ToastProvider';

const Trigger = () => {
  const { notify } = useToast();
  return <button onClick={() => notify('Saved!', 'success', 4000)}>fire</button>;
};

afterEach(() => {
  vi.useRealTimers();
});

describe('ToastProvider / useToast', () => {
  it('throws when useToast is used outside the provider', () => {
    const Bare = () => { useToast(); return null; };
    // Suppress React's error boundary console noise for this expected throw.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });

  it('shows a toast on notify and auto-dismisses after the duration', async () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    act(() => { screen.getByRole('button', { name: 'fire' }).click(); });
    expect(screen.getByRole('status')).toHaveTextContent('Saved!');

    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.queryByText('Saved!')).not.toBeInTheDocument();
  });

  it('can be dismissed manually', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'fire' }));
    expect(screen.getByText('Saved!')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByText('Saved!')).not.toBeInTheDocument();
  });
});
