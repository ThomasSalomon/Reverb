import { cloneElement, ReactElement, ReactNode } from "react";
import styles from "./Field.module.css";

type FieldControlProps = {
  id?: string;
  required?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

interface FieldProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactElement<FieldControlProps>;
}

export default function Field({
  id,
  label,
  hint,
  error,
  required = false,
  className,
  children,
}: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [
    children.props["aria-describedby"],
    hintId,
    errorId,
  ].filter(Boolean).join(" ") || undefined;

  const control = cloneElement(children, {
    id,
    required: required || children.props.required,
    "aria-invalid": Boolean(error) || children.props["aria-invalid"] || undefined,
    "aria-describedby": describedBy,
  });

  return (
    <div className={[styles.field, className ?? ""].filter(Boolean).join(" ")}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {required && <span className={styles.required} aria-hidden="true">*</span>}
      </label>
      {control}
      {hint && <p id={hintId} className={styles.hint}>{hint}</p>}
      {error && <p id={errorId} className={styles.error}>{error}</p>}
    </div>
  );
}
