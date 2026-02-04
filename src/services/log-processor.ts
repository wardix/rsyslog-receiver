import { loadRules, config } from '../config';
import type { Condition, Rule, SyslogMessage } from '../types';
import { executeAction } from './actions';
import { shouldProcess } from './deduplication';
import { applyPreprocessors } from './preprocessor';
import { metrics } from '../routes/metrics';

const rulesConfig = loadRules();

function debugLog(...args: unknown[]): void {
    if (config.debugLog) {
        console.log('[DEBUG]', ...args);
    }
}

function evaluateCondition(condition: Condition, log: SyslogMessage): boolean {
    const { field, operator, value } = condition;
    const fieldValue = String(log[field] ?? '');

    switch (operator) {
        case 'equals':
            return fieldValue === value;
        case 'not_equals':
            return fieldValue !== value;
        case 'contains':
            return fieldValue.includes(value);
        case 'not_contains':
            return !fieldValue.includes(value);
        case 'regex':
            try {
                const regex = new RegExp(value);
                return regex.test(fieldValue);
            } catch {
                console.error(`Invalid regex: ${value}`);
                return false;
            }
        default:
            return false;
    }
}

function matchRule(rule: Rule, log: SyslogMessage): boolean {
    const operator = rule.matchOperator ?? 'and';

    if (operator === 'and') {
        return rule.conditions.every((c) => evaluateCondition(c, log));
    } else {
        return rule.conditions.some((c) => evaluateCondition(c, log));
    }
}

async function executeRuleActions(rule: Rule, log: SyslogMessage): Promise<void> {
    for (const action of rule.actions) {
        await executeAction(action, log, rule.name);
    }
}

// Callback for when deduplicated messages are flushed
async function onDeduplicationFlush(
    rule: Rule,
    summaryLog: SyslogMessage,
    _count: number
): Promise<void> {
    metrics.logsMatched.inc({ rule_name: rule.name });
    await executeRuleActions(rule, summaryLog);
}

export async function processLog(log: SyslogMessage): Promise<void> {
    metrics.logsReceived.inc();

    const timer = metrics.processingDuration.startTimer();

    try {
        // Log before preprocessor
        debugLog('Before preprocessor:', JSON.stringify(log));

        // Apply global preprocessors first
        const processedLog = applyPreprocessors(log, rulesConfig.preprocessors ?? []);

        // Log after preprocessor
        debugLog('After preprocessor:', JSON.stringify(processedLog));

        for (const rule of rulesConfig.rules) {
            if (matchRule(rule, processedLog)) {
                debugLog(`Rule matched: "${rule.name}"`);

                // Check deduplication - if false, message is suppressed
                if (shouldProcess(rule, processedLog, onDeduplicationFlush)) {
                    debugLog(`Rule applied: "${rule.name}" (actions executed)`);
                    metrics.logsMatched.inc({ rule_name: rule.name });
                    await executeRuleActions(rule, processedLog);
                } else {
                    debugLog(`Rule suppressed: "${rule.name}" (deduplication)`);
                    metrics.logsSuppressed.inc({ rule_name: rule.name });
                }
            }
        }
    } finally {
        timer();
    }
}

export async function processLogs(logs: SyslogMessage | SyslogMessage[]): Promise<void> {
    const logArray = Array.isArray(logs) ? logs : [logs];

    for (const log of logArray) {
        await processLog(log);
    }
}


