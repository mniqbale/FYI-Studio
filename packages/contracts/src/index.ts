export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  WAITING_APPROVAL = 'waiting_approval',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum WorkerStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
}

export interface ModelPolicy {
  provider: string;
  model: string;
  temperature?: number;
  max_tokens?: number;
}

export interface TenantContext {
  brand_voice: string;
  language: string;
  forbidden_terms: string[];
  [key: string]: unknown;
}

export interface TaskEnvelope {
  contract_version: '1.1';
  job_id: string;
  execution_id: string;
  tenant_id: string;
  step_id: string;
  capability: string;
  attempt: number;
  policy: ModelPolicy;
  context: TenantContext;
  payload: Record<string, unknown>;
  references: Record<string, string>;
  started_at: string;
}

export interface UsageMetrics {
  tokens_in?: number;
  tokens_out?: number;
  seconds?: number;
  cost_estimate: number;
}

export interface PerformanceMetrics {
  duration_ms: number;
  started_at: string;
  finished_at: string;
}

export interface WorkerError {
  code: string;
  message: string;
  retryable: boolean;
  stack?: string;
}

export interface WorkerResponse {
  contract_version: '1.1';
  job_id: string;
  execution_id: string;
  worker_id: string;
  worker_version: string;
  status: WorkerStatus;
  output: Record<string, unknown>;
  new_references: Record<string, string>;
  usage: UsageMetrics;
  performance: PerformanceMetrics;
  error?: WorkerError;
}

export interface RecipeStep {
  id: string;
  capability: string;
  worker_label: string;
  requires_approval: boolean;
  input_mapping: Record<string, string>;
}

export interface ProductionRecipe {
  name: string;
  steps: RecipeStep[];
}

export const CONTRACT_VERSION = '1.1' as const;
