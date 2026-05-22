import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from './Modal';

describe('Modal', () => {
  it('does not render when closed', () => {
    render(<Modal open={false} onClose={() => {}} title="Hidden"><p>body</p></Modal>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders an accessible dialog labelled by its title when open', () => {
    render(<Modal open onClose={() => {}} title="Edit role"><p>body</p></Modal>);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Edit role');
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Edit role"><p>body</p></Modal>);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the close button is clicked', async () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Edit role"><p>body</p></Modal>);
    await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps focus within the dialog when tabbing past the last element', async () => {
    render(
      <Modal open onClose={() => {}} title="Edit role">
        <button>First</button>
      </Modal>,
    );
    // Focusables: close button + "First". Tabbing forward should wrap, never escaping.
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
