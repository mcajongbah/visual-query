import type { Node, Edge } from "@xyflow/react";
import type { SqlNodeData } from "store/query-store";
import { nodeConfigRegistry, type FieldValidator } from "./node-configs";
import type { EffectContext } from "./node-effects";

/**
 * Validation error
 */
export interface ValidationError {
  nodeId: string;
  fieldKey: string;
  message: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validate all nodes in the canvas
 */
export function validateAllNodes(
  nodes: Node<SqlNodeData>[],
  edges: Edge[],
  schema: any
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const node of nodes) {
    const nodeErrors = validateNode(node, { nodes, edges, schema } as any);
    errors.push(...nodeErrors);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a single node
 */
export function validateNode(
  node: Node<SqlNodeData>,
  context: Partial<EffectContext>
): ValidationError[] {
  const errors: ValidationError[] = [];
  const config = nodeConfigRegistry[node.data.label];

  if (!config?.fields) return errors;

  for (const field of config.fields) {
    // Check if field should be shown based on conditionals
    if (field.conditional) {
      const condValue = node.data.config?.[field.conditional.field];
      const shouldShow = evaluateConditional(
        condValue,
        field.conditional.value,
        field.conditional.operator || "equals"
      );
      if (!shouldShow) continue; // Skip validation if field is hidden
    }

    const value = node.data.config?.[field.key];
    const fieldErrors = validateField(field.key, value, field.validators || [], {
      node,
      allConfig: node.data.config,
      context,
    });

    errors.push(
      ...fieldErrors.map((msg) => ({
        nodeId: node.id,
        fieldKey: field.key,
        message: msg,
      }))
    );
  }

  return errors;
}

/**
 * Validate a single field
 */
function validateField(
  fieldKey: string,
  value: any,
  validators: FieldValidator[],
  options: {
    node: Node<SqlNodeData>;
    allConfig: any;
    context: Partial<EffectContext>;
  }
): string[] {
  const errors: string[] = [];

  for (const validator of validators) {
    const error = runValidator(validator, value, options);
    if (error) {
      errors.push(error);
    }
  }

  return errors;
}

/**
 * Run a single validator
 */
function runValidator(
  validator: FieldValidator,
  value: any,
  options: {
    node: Node<SqlNodeData>;
    allConfig: any;
    context: Partial<EffectContext>;
  }
): string | null {
  switch (validator.type) {
    case "required":
      if (value === undefined || value === null || value === "") {
        return validator.message;
      }
      if (Array.isArray(value) && value.length === 0) {
        return validator.message;
      }
      break;

    case "min":
      if (typeof value === "number" && value < (validator.value || 0)) {
        return validator.message;
      }
      if (
        typeof value === "string" &&
        value.length < (validator.value || 0)
      ) {
        return validator.message;
      }
      if (Array.isArray(value) && value.length < (validator.value || 0)) {
        return validator.message;
      }
      break;

    case "max":
      if (
        typeof value === "number" &&
        value > (validator.value || Infinity)
      ) {
        return validator.message;
      }
      if (
        typeof value === "string" &&
        value.length > (validator.value || Infinity)
      ) {
        return validator.message;
      }
      if (
        Array.isArray(value) &&
        value.length > (validator.value || Infinity)
      ) {
        return validator.message;
      }
      break;

    case "regex":
      if (typeof value === "string" && validator.value instanceof RegExp) {
        if (!validator.value.test(value)) {
          return validator.message;
        }
      }
      break;

    case "custom":
      if (validator.validate) {
        const isValid = validator.validate(
          value,
          options.allConfig,
          options.context
        );
        if (!isValid) {
          return validator.message;
        }
      }
      break;
  }

  return null;
}

/**
 * Evaluate conditional visibility
 */
function evaluateConditional(
  fieldValue: any,
  expectedValue: any,
  operator: "equals" | "notEquals" | "includes" | "notIncludes"
): boolean {
  switch (operator) {
    case "equals":
      return fieldValue === expectedValue;
    case "notEquals":
      return fieldValue !== expectedValue;
    case "includes":
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(expectedValue);
      }
      return false;
    case "notIncludes":
      if (Array.isArray(fieldValue)) {
        return !fieldValue.includes(expectedValue);
      }
      return true;
    default:
      return false;
  }
}

/**
 * Get validation errors for a specific node
 */
export function getNodeValidationErrors(
  nodeId: string,
  allErrors: ValidationError[]
): ValidationError[] {
  return allErrors.filter((e) => e.nodeId === nodeId);
}

/**
 * Get validation errors for a specific field
 */
export function getFieldValidationErrors(
  nodeId: string,
  fieldKey: string,
  allErrors: ValidationError[]
): ValidationError[] {
  return allErrors.filter((e) => e.nodeId === nodeId && e.fieldKey === fieldKey);
}

/**
 * Check if node has validation errors
 */
export function nodeHasErrors(
  nodeId: string,
  allErrors: ValidationError[]
): boolean {
  return allErrors.some((e) => e.nodeId === nodeId);
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) return "";

  // Group errors by node
  const errorsByNode = errors.reduce(
    (acc, error) => {
      if (!acc[error.nodeId]) acc[error.nodeId] = [];
      acc[error.nodeId].push(error);
      return acc;
    },
    {} as Record<string, ValidationError[]>
  );

  const messages: string[] = [];
  for (const [nodeId, nodeErrors] of Object.entries(errorsByNode)) {
    messages.push(
      `Node ${nodeId}: ${nodeErrors.map((e) => e.message).join(", ")}`
    );
  }

  return messages.join("\n");
}

/**
 * Validate specific data types
 */
export const typeValidators = {
  isNumber: (value: any): boolean => {
    return typeof value === "number" && !isNaN(value);
  },

  isInteger: (value: any): boolean => {
    return Number.isInteger(value);
  },

  isPositive: (value: number): boolean => {
    return value > 0;
  },

  isNonNegative: (value: number): boolean => {
    return value >= 0;
  },

  isEmail: (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },

  isUrl: (value: string): boolean => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },

  isAlphanumeric: (value: string): boolean => {
    return /^[a-zA-Z0-9]+$/.test(value);
  },

  isValidIdentifier: (value: string): boolean => {
    // SQL identifier rules: start with letter or underscore, followed by letters, digits, or underscores
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);
  },

  isNotEmpty: (value: any): boolean => {
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return value !== null && value !== undefined;
  },
};

/**
 * Common validator factories
 */
export const validatorFactories = {
  required: (message = "This field is required"): FieldValidator => ({
    type: "required",
    message,
  }),

  min: (value: number, message?: string): FieldValidator => ({
    type: "min",
    value,
    message: message || `Must be at least ${value}`,
  }),

  max: (value: number, message?: string): FieldValidator => ({
    type: "max",
    value,
    message: message || `Must be at most ${value}`,
  }),

  regex: (pattern: RegExp, message: string): FieldValidator => ({
    type: "regex",
    value: pattern,
    message,
  }),

  custom: (
    validate: (value: any, allConfig: any, context: any) => boolean,
    message: string
  ): FieldValidator => ({
    type: "custom",
    validate,
    message,
  }),
};
