import { Eye, EyeOff } from 'lucide-react';
import { useId, useState } from 'react';

/** Labelled input with an inline error and optional hint. The error is linked for screen readers. */
export default function Field({ label, error, hint, type = 'text', ...inputProps }) {
  const id = useId();
  const [isShown, setIsShown] = useState(false);
  const isPassword = type === 'password';
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="field-control">
        <input id={id} type={isPassword && isShown ? 'text' : type} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...inputProps} />
        {isPassword && (
          <button type="button" className="icon-btn icon-btn-sm" onClick={() => setIsShown(!isShown)} aria-label={isShown ? 'Hide password' : 'Show password'}>
            {isShown ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        )}
      </div>
      {hint && !error && <p id={`${id}-hint`} className="field-hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="field-error" role="alert">{error}</p>}
    </div>
  );
}
