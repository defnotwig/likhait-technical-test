/**
 * Custom hook for managing expense form state and validation
 */

import { useState } from "react";
import { ExpenseFormData } from "../types";
import { formatDate } from "../utils/expenseUtils";

interface UseExpenseFormProps {
  initialData?: Partial<ExpenseFormData>;
  onSubmit: (data: ExpenseFormData) => Promise<void>;
}

export function useExpenseForm({ initialData, onSubmit }: UseExpenseFormProps) {
  const [formData, setFormData] = useState<ExpenseFormData>({
    amount: initialData?.amount || "",
    description: initialData?.description || "",
    categoryId: initialData?.categoryId || "",
    date: initialData?.date || formatDate(new Date()),
  });

  const [errors, setErrors] = useState<Partial<ExpenseFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleChange = (field: keyof ExpenseFormData, value: string) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
    setSubmitError("");
    if (errors[field]) {
      setErrors((previous) => ({ ...previous, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<ExpenseFormData> = {};

    if (!formData.amount || Number(formData.amount) <= 0) {
      newErrors.amount = "Amount must be greater than 0";
    }

    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    }

    if (!formData.categoryId) {
      newErrors.categoryId = "Category is required";
    }

    if (!formData.date) {
      newErrors.date = "Date is required";
    } else if (formData.date > formatDate(new Date())) {
      newErrors.date = "Expense date cannot be in the future";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitError("");
    try {
      await onSubmit(formData);
      setFormData({
        amount: "",
        description: "",
        categoryId: "",
        date: formatDate(new Date()),
      });
      setErrors({});
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to save expense.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      amount: initialData?.amount || "",
      description: initialData?.description || "",
      categoryId: initialData?.categoryId || "",
      date: initialData?.date || formatDate(new Date()),
    });
    setErrors({});
    setSubmitError("");
  };

  return {
    formData,
    errors,
    isSubmitting,
    submitError,
    handleChange,
    handleSubmit,
    resetForm,
  };
}
