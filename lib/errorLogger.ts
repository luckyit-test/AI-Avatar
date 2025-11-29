/**
 * Утилита для сбора и отображения диагностической информации об ошибках
 */

interface ErrorLog {
    timestamp: string;
    type: string;
    message: string;
    details?: any;
    userAgent?: string;
    url?: string;
}

class ErrorLogger {
    private logs: ErrorLog[] = [];
    private maxLogs = 50;

    log(type: string, message: string, details?: any) {
        const logEntry: ErrorLog = {
            timestamp: new Date().toISOString(),
            type,
            message,
            details,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
            url: typeof window !== 'undefined' ? window.location.href : 'unknown'
        };

        this.logs.push(logEntry);
        
        // Ограничиваем количество логов
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // Сохраняем в localStorage для последующего просмотра
        try {
            localStorage.setItem('errorLogs', JSON.stringify(this.logs));
        } catch (e) {
            // Игнорируем ошибки localStorage
        }

        console.error(`[${type}]`, message, details || '');
    }

    getLogs(): ErrorLog[] {
        return [...this.logs];
    }

    clearLogs() {
        this.logs = [];
        try {
            localStorage.removeItem('errorLogs');
        } catch (e) {
            // Игнорируем ошибки localStorage
        }
    }

    getLogsAsText(): string {
        return this.logs.map(log => {
            return `[${log.timestamp}] ${log.type}: ${log.message}\n${log.details ? JSON.stringify(log.details, null, 2) : ''}\n---\n`;
        }).join('\n');
    }

    copyLogsToClipboard(): Promise<void> {
        const text = this.getLogsAsText();
        return navigator.clipboard.writeText(text);
    }
}

export const errorLogger = new ErrorLogger();

