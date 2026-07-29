import { ButtonHTMLAttributes, forwardRef } from "react";
import styles from "./Button.module.css";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "neon" | "secondary" | "danger";
  size?: "default" | "compact";
  isLoading?: boolean;
  loadingLabel?: string;
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "default",
    isLoading = false,
    loadingLabel,
    fullWidth = false,
    className,
    disabled,
    type = "button",
    children,
    ...props
  },
  ref,
) {
  const classes = [
    styles.button,
    styles[variant],
    size === "compact" ? styles.compact : "",
    fullWidth ? styles.fullWidth : "",
    className ?? "",
  ].filter(Boolean).join(" ");

  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
    >
      {isLoading && loadingLabel ? loadingLabel : children}
    </button>
  );
});

export default Button;
