import { Hono } from 'hono';
import { config } from './config';
import { basicAuthMiddleware } from './middleware/auth';
import logsRoute from './routes/logs';
import metricsRoute from './routes/metrics';

const app = new Hono();

// Health check (no auth required)
app.get('/health', (c) => c.json({ status: 'ok' }));

// Metrics endpoint (no auth required for Prometheus scraping)
app.route('/metrics', metricsRoute);

// Protected routes
app.use('/logs/*', basicAuthMiddleware);
app.route('/logs', logsRoute);

console.log(`Starting rsyslog receiver on port ${config.port}`);

export default {
    port: config.port,
    fetch: app.fetch,
};
