/**
 * Reusable SelectBox component
 */

import React, { useId } from "react";
import { COLORS } from "../constants/colors";

interface SelectBoxProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
  options: Array<{ value: string; label: string }>;
}

export function SelectBox({
  label,
  error,
  fullWidth = false,
  options,
  ...props
}: SelectBoxProps) {
  const generatedId = useId();
  const {
    id: providedId,
    "aria-describedby": describedBy,
    ...selectProps
  } = props;
  const selectId = providedId || generatedId;
  const errorId = `${selectId}-error`;
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

  const selectStyle: React.CSSProperties = {
    padding: "0.5rem 0.75rem",
    fontSize: "1rem",
    border: `1px solid ${error ? COLORS.danger : COLORS.border}`,
    borderRadius: "0.375rem",
    outline: "none",
    transition: "border-color 0.2s",
    backgroundColor: COLORS.background.main,
    color: COLORS.text.primary,
    cursor: "pointer",
  };

  const errorStyle: React.CSSProperties = {
    fontSize: "0.75rem",
    color: COLORS.danger,
    marginTop: "-0.25rem",
  };

  return (
    <div style={containerStyle}>
      {label && (
        <label htmlFor={selectId} style={labelStyle}>
          {label}
        </label>
      )}
      <select
        id={selectId}
        style={selectStyle}
        aria-invalid={Boolean(error)}
        aria-describedby={ariaDescribedBy}
        {...selectProps}
      >
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <span id={errorId} role="alert" style={errorStyle}>
          {error}
        </span>
      )}
    </div>
  );
}
