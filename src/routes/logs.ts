import { Hono } from 'hono';
import { processLogs } from '../services/log-processor';
import type { SyslogMessage } from '../types';

const logsRoute = new Hono();

logsRoute.post('/', async (c) => {
    try {
        const body = await c.req.json<SyslogMessage | SyslogMessage[]>();
        await processLogs(body);
        return c.json({ status: 'ok' });
    } catch (error) {
        console.error('Error processing log:', error);
        return c.json({ status: 'error', message: 'Invalid JSON' }, 400);
    }
});

export default logsRoute;
