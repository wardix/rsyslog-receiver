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

export interface Rule {
  name: string;
  matchOperator?: 'and' | 'or';  // Default: 'and'
  conditions: Condition[];
  actions: ActionConfig[];
}

export interface RulesConfig {
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
