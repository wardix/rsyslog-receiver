import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { UsersConfig, RulesConfig } from './types';

const CONFIG_DIR = process.cwd();

export const config = {
    port: parseInt(process.env.PORT || '3000', 10),
};

export function loadUsers(): UsersConfig {
    const usersPath = join(CONFIG_DIR, 'users.json');
    if (!existsSync(usersPath)) {
        console.warn('users.json not found, using empty users list');
        return { users: [] };
    }
    const content = readFileSync(usersPath, 'utf-8');
    return JSON.parse(content) as UsersConfig;
}

export function loadRules(): RulesConfig {
    const rulesPath = join(CONFIG_DIR, 'rules.json');
    if (!existsSync(rulesPath)) {
        console.warn('rules.json not found, using empty rules list');
        return { rules: [] };
    }
    const content = readFileSync(rulesPath, 'utf-8');
    return JSON.parse(content) as RulesConfig;
}
