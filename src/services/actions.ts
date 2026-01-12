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
    config: {
        url: string;
        method: string;
        headers?: Record<string, string>;
        bodyTemplate?: Record<string, unknown>;
    },
    log: SyslogMessage
): Promise<void> {
    // Build request body - use template if provided, otherwise send raw log
    const body = config.bodyTemplate
        ? renderTemplate(config.bodyTemplate, log)
        : log;

    const response = await fetch(config.url, {
        method: config.method,
        headers: {
            'Content-Type': 'application/json',
            ...config.headers,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}`);
    }
}

// Replace {{field}} placeholders with log values
function renderTemplate(
    template: Record<string, unknown>,
    log: SyslogMessage
): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(template)) {
        if (typeof value === 'string') {
            // Replace all {{field}} placeholders in string
            result[key] = value.replace(/\{\{(\w+)\}\}/g, (_, field) => {
                return String(log[field] ?? '');
            });
        } else if (Array.isArray(value)) {
            // Handle arrays recursively
            result[key] = value.map((item) => {
                if (typeof item === 'string') {
                    return item.replace(/\{\{(\w+)\}\}/g, (_, field) => {
                        return String(log[field] ?? '');
                    });
                } else if (typeof item === 'object' && item !== null) {
                    return renderTemplate(item as Record<string, unknown>, log);
                }
                return item;
            });
        } else if (typeof value === 'object' && value !== null) {
            // Handle nested objects recursively
            result[key] = renderTemplate(value as Record<string, unknown>, log);
        } else {
            result[key] = value;
        }
    }

    return result;
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
