/**
 * Reusable TextField component
 */

import React, { useId } from "react";
import { COLORS } from "../constants/colors";

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}

export function TextField({
  label,
  error,
  fullWidth = false,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const {
    id: providedId,
    "aria-describedby": describedBy,
    ...inputProps
  } = props;
  const inputId = providedId || generatedId;
  const errorId = `${inputId}-error`;
  const ariaDescribedBy = [describedBy, error ? errorId : undefined]
    .filter(Boolean)
    .join(" ") || undefined;
  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    width: fullWidth ? "100%" : "auto",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: COLORS.text.primary,
  };

  const inputStyle: React.CSSProperties = {
    padding: "0.5rem 0.75rem",
    fontSize: "1rem",
    border: `1px solid ${error ? COLORS.danger : COLORS.border}`,
    borderRadius: "0.375rem",
    outline: "none",
    transition: "border-color 0.2s",
    backgroundColor: COLORS.background.main,
    color: COLORS.text.primary,
  };

  const errorStyle: React.CSSProperties = {
    fontSize: "0.75rem",
    color: COLORS.danger,
    marginTop: "-0.25rem",
  };

  return (
    <div style={containerStyle}>
      {label && (
        <label htmlFor={inputId} style={labelStyle}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        style={inputStyle}
        aria-invalid={Boolean(error)}
        aria-describedby={ariaDescribedBy}
        {...inputProps}
      />
      {error && (
        <span id={errorId} role="alert" style={errorStyle}>
          {error}
        </span>
      )}
    </div>
  );
}
