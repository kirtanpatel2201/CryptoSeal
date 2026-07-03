/**
 * Vercel Speed Insights Initialization
 * Injects Speed Insights tracking for Core Web Vitals monitoring
 */

import { injectSpeedInsights } from '../../lib/speed-insights.js';

// Initialize Speed Insights
// This will automatically track Core Web Vitals (LCP, FID, CLS, FCP, TTFB, INP)
injectSpeedInsights({
    debug: false, // Set to true for development debugging
    // beforeSend: (event) => {
    //     // Optional: Modify or filter events before sending
    //     // Return null to cancel the event
    //     return event;
    // },
    // sampleRate: 1, // Send 100% of events (adjust to reduce costs if needed)
});
