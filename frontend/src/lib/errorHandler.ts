// Global error handler for URL-related errors
export function setupGlobalErrorHandler() {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.message && event.reason.message.includes('Invalid URL')) {
      console.error('🚨 Global URL Error Caught:', {
        message: event.reason.message,
        stack: event.reason.stack,
        timestamp: new Date().toISOString()
      });
      
      // Prevent the error from crashing the app
      event.preventDefault();
    }
  });

  // Handle general errors
  window.addEventListener('error', (event) => {
    if (event.error && event.error.message && event.error.message.includes('Invalid URL')) {
      console.error('🚨 Global URL Error Caught:', {
        message: event.error.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error.stack,
        timestamp: new Date().toISOString()
      });
      
      // Prevent the error from crashing the app
      event.preventDefault();
    }
  });

  console.log('✅ Global URL error handler initialized');
}

// Safe URL constructor wrapper
export function safeCreateURL(url: string, base?: string): URL | null {
  try {
    if (!url || typeof url !== "string" || url.trim() === "") {
      console.warn('safeCreateURL: Invalid URL input:', url);
      return null;
    }
    
    const trimmedUrl = url.trim();
    return new URL(trimmedUrl, base);
  } catch (error) {
    console.warn('safeCreateURL: Failed to create URL:', {
      url,
      base,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

// Safe URLSearchParams constructor wrapper
export function safeCreateURLSearchParams(search: string): URLSearchParams | null {
  try {
    if (typeof search !== "string") {
      console.warn('safeCreateURLSearchParams: Invalid search input:', search);
      return null;
    }
    
    return new URLSearchParams(search);
  } catch (error) {
    console.warn('safeCreateURLSearchParams: Failed to create URLSearchParams:', {
      search,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}