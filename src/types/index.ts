export interface User {
  username: string;
  password: string;
}

export interface UsersConfig {
  users: User[];
}

export interface Condition {
  field: string;
  operator: 'equals' | 'contains' | 'regex' | 'not_equals' | 'not_contains';
  value: string;
}

export interface WebhookActionConfig {
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  contentType?: 'application/json' | 'application/x-www-form-urlencoded';  // Default: application/json
  bodyTemplate?: Record<string, unknown>;  // Template with {{field}} placeholders
}

export interface LogToFileActionConfig {
  path: string;
}

export interface ConsoleActionConfig {
  prefix?: string;
}

export type ActionConfig = {
  type: 'webhook';
  config: WebhookActionConfig;
} | {
  type: 'log_to_file';
  config: LogToFileActionConfig;
} | {
  type: 'console';
  config?: ConsoleActionConfig;
};

export interface RepeatedMsgReductionConfig {
  enabled: boolean;
  timeoutSeconds: number;      // Flush after this many seconds of no duplicates
  keyFields: string[];         // Fields to compare for deduplication (e.g., ["host", "message"])
  sendSummary?: boolean;       // Send "last message repeated X times" on flush (default: true)
}

export interface Rule {
  name: string;
  matchOperator?: 'and' | 'or';  // Default: 'and'
  conditions: Condition[];
  actions: ActionConfig[];
  repeatedMsgReduction?: RepeatedMsgReductionConfig;
}

export interface Preprocessor {
  field: string;           // Field to transform (e.g., "message")
  pattern: string;         // Regex pattern to match
  replacement?: string;    // Replacement string (supports $1, $2, etc.) — required if extract is false
  extract?: boolean;       // If true, named capture groups are extracted as new top-level fields
}

export interface RulesConfig {
  preprocessors?: Preprocessor[];  // Global preprocessors applied before rules
  rules: Rule[];
}

export interface SyslogMessage {
  timestamp?: string;
  host?: string;
  severity?: string;
  facility?: string;
  tag?: string;
  message?: string;
  [key: string]: unknown;
}
