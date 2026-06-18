export interface StatusJSON {
  project: string;
  blueprint: string;
  lastApplied: string;
  providers: StatusProvider[];
  sources: { total: number; changed: number };
}

export interface StatusProvider {
  name: string;
  displayLabel: string;
  status: 'active' | 'deprecated' | 'sunset';
  deprecatedBy: string;
  sunsetDate: string;
  fileCount: number;
  driftCount: number;
  lastApplied: string;
  outputDir: string;
}

export interface ApplyProviderEvent {
  event: 'provider';
  provider: string;
  displayLabel: string;
  fileCount: number;
  outputDir: string;
}

export interface ApplySummaryEvent {
  event: 'summary';
  totalProviders: number;
  totalFiles: number;
  duration: string;
}

export type ApplyEvent = ApplyProviderEvent | ApplySummaryEvent;

export interface ListResourceJSON {
  kind: string;
  name: string;
  target: string;
  source: string;
}
