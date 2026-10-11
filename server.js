const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Welcome to Homework Session 10 - Exercise 3 Backend API',
    build: process.env.BUILD_TYPE || 'production-multistage',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    node_version: process.version,
    memory_usage: process.memoryUsage()
  });
});

// Sample data endpoint
app.get('/api/data', (req, res) => {
  res.json({
    code: 200,
    data: [
      { id: 1, name: 'Docker Multi-stage Build', category: 'DevOps' },
      { id: 2, name: 'Layer Caching Optimization', category: 'Performance' },
      { id: 3, name: 'Alpine Minimal Runtime', category: 'Security' }
    ]
  });
});

const server = app.listen(PORT, () => {
  console.log(`[hw-backend] Server is running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[hw-backend] SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('[hw-backend] HTTP server closed');
  });
});
