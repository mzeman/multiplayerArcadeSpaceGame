/**
 * Shared conditional logger utility.
 * Controlled by the LOG_LEVEL environment variable.
 * Levels: 'debug', 'info', 'warn', 'error' (default: 'info')
 */

// Determine log level - default to 'info'
// Note: In a browser environment, process.env might not be directly available.
// Build tools (like Webpack's DefinePlugin) or runtime checks (localStorage)
// might be needed for client-side configuration. For the server, process.env is standard.
// DefinePlugin should replace process.env.LOG_LEVEL with a literal string (e.g., "'debug'")
// We need to handle the case where it might not be defined during build.
let LOG_LEVEL = 'info'; // Default level
try {
    // This assumes DefinePlugin replaced process.env.LOG_LEVEL with something like "'debug'"
    const levelFromEnv = process.env.LOG_LEVEL;
    if (typeof levelFromEnv === 'string' && levelFromEnv.length > 0) {
        LOG_LEVEL = levelFromEnv.toLowerCase();
    }
} catch (e) {
    // If process or process.env is not defined at all, this might throw. Ignore and use default.
    console.warn("Could not read process.env.LOG_LEVEL, defaulting to 'info'. DefinePlugin might not be configured correctly.");
}

const levels: { [key: string]: number } = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    silent: 4, // Level to disable all logs
};

// Determine the current numeric level, defaulting to 'info' if invalid
const currentLevel = levels[LOG_LEVEL] ?? levels.info;

export const logger = {
    debug: (...args: any[]) => {
        if (currentLevel <= levels.debug) {
            console.debug('[DEBUG]', ...args); // Use console.debug for semantic correctness
        }
    },
    info: (...args: any[]) => {
        if (currentLevel <= levels.info) {
            console.info('[INFO]', ...args);
        }
    },
    warn: (...args: any[]) => {
        if (currentLevel <= levels.warn) {
            console.warn('[WARN]', ...args);
        }
    },
    error: (...args: any[]) => {
        if (currentLevel <= levels.error) {
            console.error('[ERROR]', ...args);
        }
    },
    // Method to check current level if needed elsewhere
    getCurrentLevel: () => LOG_LEVEL,
    isLevelEnabled: (level: keyof typeof levels): boolean => {
        return currentLevel <= (levels[level] ?? levels.silent);
    }
};

// Initial log to show the active level (useful for debugging setup)
logger.info(`Logger initialized with level: ${LOG_LEVEL} (numeric: ${currentLevel})`);