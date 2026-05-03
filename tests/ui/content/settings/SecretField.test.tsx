import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SecretField } from '../../../../src/ui/content/settings/SecretField';

describe('SecretField', () => {
  it('masks multiline credentials until the field is revealed', () => {
    const onChange = vi.fn();

    render(
      <SecretField
        label="Access Token"
        multiline
        toggleDisabled={false}
        value="secret-token"
        onChange={onChange}
      />,
    );

    const field = screen.getByLabelText('Access Token');

    expect(field).toHaveValue('••••••••••••');

    fireEvent.change(field, { target: { value: 'ignored' } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /API Key/ }));
    fireEvent.change(screen.getByLabelText('Access Token'), { target: { value: 'next-token' } });

    expect(onChange).toHaveBeenCalledWith('next-token');
  });

  it('separates toggle disabled state from input disabled state', () => {
    const onChange = vi.fn();

    render(<SecretField label="API Key" toggleDisabled value="api-key" onChange={onChange} />);

    expect(screen.getByRole('button', { name: /API Key/ })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'next-api-key' } });

    expect(onChange).toHaveBeenCalledWith('next-api-key');
  });
});
