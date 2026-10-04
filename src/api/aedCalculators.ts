/** Validated clinical calculators (deterministic; each names its reference). */

import { apiFetch } from '../utils/api';

export interface CalculatorField {
  title: string;
  type?: 'integer' | 'number' | 'boolean' | 'string';
  enum?: string[];
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  default?: any;
  anyOf?: { type?: string; minimum?: number; maximum?: number; exclusiveMinimum?: number }[];
}

export interface Calculator {
  name: string;
  title: string;
  inputs: { properties: Record<string, CalculatorField>; required?: string[] };
}

export interface CalculatorResult {
  name: string;
  value: number;
  unit: string;
  category: string | null;
  interpretation: string;
  reference: string;
  details: Record<string, any>;
}

export const fetchCalculators = (token: string): Promise<{ calculators: Calculator[] }> =>
  apiFetch('/api/aed/calculators', token);

export const runCalculator = (token: string, name: string, values: Record<string, any>): Promise<CalculatorResult> =>
  apiFetch(`/api/aed/calculators/${encodeURIComponent(name)}`, token, { method: 'POST', body: JSON.stringify(values) });

/** The field's own type, unwrapping an optional (`anyOf: [{type}, {type: 'null'}]`). */
export function fieldType(f: CalculatorField): 'integer' | 'number' | 'boolean' | 'string' {
  return (f.type ?? (f.anyOf?.find(x => x.type && x.type !== 'null')?.type as any) ?? 'string');
}
