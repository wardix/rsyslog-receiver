import type { Rule, SyslogMessage } from '../types';

interface TrackedMessage {
    key: string;
    count: number;
    firstLog: SyslogMessage;
    lastSeen: number;
    timeoutHandle: ReturnType<typeof setTimeout>;
}

type FlushCallback = (rule: Rule, log: SyslogMessage, count: number) => Promise<void>;

// Store tracked messages per rule
const trackedMessages = new Map<string, TrackedMessage>();

function generateKey(log: SyslogMessage, keyFields: string[]): string {
    return keyFields.map((field) => String(log[field] ?? '')).join('|');
}

export function shouldProcess(
    rule: Rule,
    log: SyslogMessage,
    onFlush: FlushCallback
): boolean {
    const config = rule.repeatedMsgReduction;

    // If not enabled, always process
    if (!config?.enabled) {
        return true;
    }

    const ruleKey = rule.name;
    const msgKey = generateKey(log, config.keyFields);
    const fullKey = `${ruleKey}:${msgKey}`;
    const now = Date.now();

    const tracked = trackedMessages.get(fullKey);

    if (tracked && tracked.key === msgKey) {
        // Same message - increment count and reset timeout
        tracked.count++;
        tracked.lastSeen = now;

        // Reset timeout
        clearTimeout(tracked.timeoutHandle);
        tracked.timeoutHandle = setTimeout(() => {
            flushTracked(fullKey, rule, onFlush);
        }, config.timeoutSeconds * 1000);

        return false; // Suppress this message
    }

    // Different message or first message
    if (tracked) {
        // Flush previous tracked message first
        clearTimeout(tracked.timeoutHandle);
        flushTrackedSync(fullKey, rule, onFlush);
    }

    // Start tracking new message
    const timeoutHandle = setTimeout(() => {
        flushTracked(fullKey, rule, onFlush);
    }, config.timeoutSeconds * 1000);

    trackedMessages.set(fullKey, {
        key: msgKey,
        count: 1,
        firstLog: log,
        lastSeen: now,
        timeoutHandle,
    });

    return true; // Process this message (first occurrence)
}

async function flushTracked(
    fullKey: string,
    rule: Rule,
    onFlush: FlushCallback
): Promise<void> {
    const tracked = trackedMessages.get(fullKey);
    if (!tracked) return;

    trackedMessages.delete(fullKey);

    // Check if sendSummary is enabled (default: true)
    const sendSummary = rule.repeatedMsgReduction?.sendSummary ?? true;

    if (tracked.count > 1 && sendSummary) {
        // Create summary message
        const summaryLog: SyslogMessage = {
            ...tracked.firstLog,
            message: `last message repeated ${tracked.count - 1} times`,
            _originalMessage: tracked.firstLog.message,
            _repeatCount: tracked.count,
        };

        await onFlush(rule, summaryLog, tracked.count);
    }
}

function flushTrackedSync(
    fullKey: string,
    rule: Rule,
    onFlush: FlushCallback
): void {
    // Fire and forget - we can't await here
    flushTracked(fullKey, rule, onFlush);
}

// Cleanup function for graceful shutdown
export function flushAll(onFlush: FlushCallback, rules: Rule[]): Promise<void[]> {
    const promises: Promise<void>[] = [];

    for (const [fullKey, tracked] of trackedMessages.entries()) {
        clearTimeout(tracked.timeoutHandle);
        const ruleName = fullKey.split(':')[0];
        const rule = rules.find((r) => r.name === ruleName);
        if (rule) {
            promises.push(flushTracked(fullKey, rule, onFlush));
        }
    }

    return Promise.all(promises);
}
