// Shared presentation only: native props, refs, events and validation pass through.
import { Children, isValidElement } from "react";

const classes = (base, extra) => [base, extra].filter(Boolean).join(" ");
const visibleText = (children) => Children.toArray(children).map((child) => isValidElement(child) ? visibleText(child.props.children) : String(child)).join("");

export function FormSection({ as: Tag = "section", className, children, ...props }) {
  return <Tag {...props} className={classes("ui-form-section", className)}>{children}</Tag>;
}

export function FormGrid({ as: Tag = "div", className, children, ...props }) {
  return <Tag {...props} className={classes("ui-form-grid", className)}>{children}</Tag>;
}

export function FormField({ className, children, ...props }) {
  const required = Children.toArray(children).some((child) => isValidElement(child) && child.props.required);
  const showRequired = required && !visibleText(children).includes("*");
  return <label {...props} data-required={showRequired || undefined} className={classes("ui-form-field", className)}>{children}</label>;
}

export function Input({ className, ...props }) {
  return <input {...props} className={classes("ui-input", className)} />;
}

export function Select({ className, children, ...props }) {
  return <select {...props} className={classes("ui-select", className)}>{children}</select>;
}

export function Textarea({ className, ...props }) {
  return <textarea {...props} className={classes("ui-textarea", className)} />;
}

export function FormActions({ as: Tag = "footer", className, children, ...props }) {
  return <Tag {...props} className={classes("ui-form-actions", className)}>{children}</Tag>;
}
