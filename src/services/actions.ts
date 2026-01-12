import { appendFileSync } from 'fs';
import type { ActionConfig, SyslogMessage } from '../types';
import { metrics } from '../routes/metrics';

export async function executeAction(
    action: ActionConfig,
    log: SyslogMessage,
    ruleName: string
): Promise<void> {
    try {
        switch (action.type) {
            case 'webhook':
                await executeWebhook(action.config, log);
                break;
            case 'log_to_file':
                executeLogToFile(action.config, log);
                break;
            case 'console':
                executeConsole(action.config, log);
                break;
        }
        metrics.actionsTriggered.inc({ action_type: action.type, rule_name: ruleName });
    } catch (error) {
        console.error(`Action ${action.type} failed for rule ${ruleName}:`, error);
    }
}

async function executeWebhook(
    config: { url: string; method: string; headers?: Record<string, string> },
    log: SyslogMessage
): Promise<void> {
    const response = await fetch(config.url, {
        method: config.method,
        headers: {
            'Content-Type': 'application/json',
            ...config.headers,
        },
        body: JSON.stringify(log),
    });

    if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}`);
    }
}

function executeLogToFile(
    config: { path: string },
    log: SyslogMessage
): void {
    const line = JSON.stringify(log) + '\n';
    appendFileSync(config.path, line);
}

function executeConsole(
    config: { prefix?: string } | undefined,
    log: SyslogMessage
): void {
    const prefix = config?.prefix || '[LOG]';
    console.log(prefix, JSON.stringify(log));
}
