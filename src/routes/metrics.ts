import { Hono } from 'hono';
import { Counter, Histogram, Registry } from 'prom-client';

const register = new Registry();

export const metrics = {
    logsReceived: new Counter({
        name: 'rsyslog_logs_received_total',
        help: 'Total number of logs received',
        registers: [register],
    }),

    logsMatched: new Counter({
        name: 'rsyslog_logs_matched_total',
        help: 'Total number of logs matched by rules',
        labelNames: ['rule_name'] as const,
        registers: [register],
    }),

    actionsTriggered: new Counter({
        name: 'rsyslog_actions_triggered_total',
        help: 'Total number of actions triggered',
        labelNames: ['action_type', 'rule_name'] as const,
        registers: [register],
    }),

    processingDuration: new Histogram({
        name: 'rsyslog_log_processing_duration_seconds',
        help: 'Duration of log processing in seconds',
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
        registers: [register],
    }),
};

const metricsRoute = new Hono();

metricsRoute.get('/', async (c) => {
    c.header('Content-Type', register.contentType);
    return c.text(await register.metrics());
});

export default metricsRoute;
