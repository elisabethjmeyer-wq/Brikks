/**
 * Logger Service - Centralized logging for debugging
 * Usage: Logger.debug('ModuleName', 'message', data)
 */
const Logger = {
    // Set to true to see debug logs during development
    DEBUG: !window.location.hostname.includes('production'),

    debug(component, message, data = null) {
        if (!this.DEBUG) return;
        console.log(`[${component}] ℹ️ ${message}`, data || '');
    },

    error(component, message, error = null) {
        console.error(`[${component}] ❌ ${message}`, error || '');
        // TODO: Send to monitoring service if needed
    },

    warn(component, message, data = null) {
        console.warn(`[${component}] ⚠️ ${message}`, data || '');
    }
};
