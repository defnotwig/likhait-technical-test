import React, { useState } from "react";
import { Button, TextField } from "../vibes";

interface CategoryFormProps {
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
}

export function CategoryForm({ onSubmit, onCancel }: CategoryFormProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedName = name.trim();

    if (!normalizedName) {
      setError("Category name is required");
      return;
    }
    if (normalizedName.length > 100) {
      setError("Category name must be 100 characters or fewer");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      await onSubmit(normalizedName);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to create the category.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
      <TextField
        autoFocus
        label="Category name"
        maxLength={100}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          if (error) setError("");
        }}
        error={error}
        placeholder="e.g. Subscriptions"
        fullWidth
        required
      />
      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Category"}
        </Button>
      </div>
    </form>
  );
}
