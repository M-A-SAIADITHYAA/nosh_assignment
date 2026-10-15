import { createApp } from './app.js';
import { closeAllSSEConnections } from './sse.js';
import { closeDb } from './db.js';

const PORT = parseInt(process.env.PORT || '5001', 10);
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`🚀 Nosh Dish Dashboard Backend running on http://localhost:${PORT}`);
  console.log(`📡 SSE Stream active on http://localhost:${PORT}/events`);
  console.log(`📋 Dishes API available on http://localhost:${PORT}/dishes`);
});

// Graceful shutdown handling
function handleShutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  closeAllSSEConnections();
  server.close(() => {
    closeDb();
    console.log('Server and database closed safely.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
