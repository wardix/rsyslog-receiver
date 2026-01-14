import type { Preprocessor, SyslogMessage } from '../types';

export function applyPreprocessors(
    log: SyslogMessage,
    preprocessors: Preprocessor[]
): SyslogMessage {
    if (!preprocessors || preprocessors.length === 0) {
        return log;
    }

    // Create a copy to avoid mutating original
    const processed = { ...log };

    for (const preprocessor of preprocessors) {
        const { field, pattern, replacement } = preprocessor;
        const fieldValue = processed[field];

        if (typeof fieldValue === 'string') {
            try {
                const regex = new RegExp(pattern, 'g');
                processed[field] = fieldValue.replace(regex, replacement);
            } catch (error) {
                console.error(`Invalid preprocessor regex: ${pattern}`, error);
            }
        }
    }

    return processed;
}
