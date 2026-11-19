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
        const { field, pattern, replacement, extract } = preprocessor;
        const fieldValue = processed[field];

        if (typeof fieldValue !== 'string') continue;

        try {
            const regex = new RegExp(pattern);

            if (extract) {
                // Extract mode: named capture groups become new top-level fields
                const match = regex.exec(fieldValue);
                if (match?.groups) {
                    for (const [key, value] of Object.entries(match.groups)) {
                        if (value !== undefined) {
                            processed[key] = value;
                        }
                    }
                }
            } else {
                // Replace mode: substitute pattern with replacement
                const globalRegex = new RegExp(pattern, 'g');
                processed[field] = fieldValue.replace(globalRegex, replacement ?? '');
            }
        } catch (error) {
            console.error(`Invalid preprocessor regex: ${pattern}`, error);
        }
    }

    return processed;
}
