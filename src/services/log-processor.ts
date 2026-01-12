import { loadRules } from '../config';
import type { Condition, Rule, SyslogMessage } from '../types';
import { executeAction } from './actions';
import { shouldProcess } from './deduplication';
import { metrics } from '../routes/metrics';

const rulesConfig = loadRules();

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
        for (const rule of rulesConfig.rules) {
            if (matchRule(rule, log)) {
                // Check deduplication - if false, message is suppressed
                if (shouldProcess(rule, log, onDeduplicationFlush)) {
                    metrics.logsMatched.inc({ rule_name: rule.name });
                    await executeRuleActions(rule, log);
                } else {
                    metrics.logsSuppressed.inc({ rule_name: rule.name });
                }
            }
        }
    } finally {
        timer();
    }
}

export async function processLogs(logs: SyslogMessage | SyslogMessage[]): Promise<void> {
    const logArray = Array.isArray(logs) ? logs : [logs]

    for (const log of logArray) {
        await processLog(log);
    }
}

