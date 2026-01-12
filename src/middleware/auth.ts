import type { Context, Next } from 'hono';
import { loadUsers } from '../config';

const users = loadUsers();

export async function basicAuthMiddleware(c: Context, next: Next) {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Basic ')) {
        c.header('WWW-Authenticate', 'Basic realm="rsyslog-receiver"');
        return c.text('Unauthorized', 401);
    }

    const base64Credentials = authHeader.slice(6);
    const credentials = atob(base64Credentials);
    const [username, password] = credentials.split(':');

    const validUser = users.users.find(
        (u) => u.username === username && u.password === password
    );

    if (!validUser) {
        c.header('WWW-Authenticate', 'Basic realm="rsyslog-receiver"');
        return c.text('Unauthorized', 401);
    }

    c.set('user', username);
    await next();
}
