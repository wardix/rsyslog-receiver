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
        contentType?: string;
        bodyTemplate?: Record<string, unknown>;
    },
    log: SyslogMessage
): Promise<void> {
    const contentType = config.contentType ?? 'application/json';

    // Render URL with {{field}} placeholders
    const url = config.url.replace(/\{\{(\w+)\}\}/g, (_, field) =>
        encodeURIComponent(String(log[field] ?? ''))
    );

    // Build request body
    let body: string;
    if (contentType === 'application/x-www-form-urlencoded') {
        const template = config.bodyTemplate
            ? (renderTemplate(config.bodyTemplate, log) as Record<string, string>)
            : (log as Record<string, string>);
        body = new URLSearchParams(template).toString();
    } else {
        const rendered = config.bodyTemplate
            ? renderTemplate(config.bodyTemplate, log)
            : log;
        body = JSON.stringify(rendered);
    }

    const response = await fetch(url, {
        method: config.method,
        headers: {
            'Content-Type': contentType,
            ...config.headers,
        },
        body,
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
