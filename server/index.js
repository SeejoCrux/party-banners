import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import authRouter from './routes/auth.js';
import uploadsRouter from './routes/uploads.js';
import bannerRouter from './routes/banner.js';
import messagesRouter from './routes/messages.js';
import partiesRouter from './routes/parties.js';
import moderationRouter from './routes/moderation.js';
import usersRouter from './routes/users.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure upload directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const bannersDir = path.join(uploadsDir, 'banners');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(bannersDir)) fs.mkdirSync(bannersDir, { recursive: true });

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded static assets
app.use('/uploads', express.static(uploadsDir));

// Mount API Routes
app.use('/api/auth', authRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/banner', bannerRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/parties', partiesRouter);
app.use('/api/moderation', moderationRouter);
app.use('/api/users', usersRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Party Banner & Moderation Live Server'
  });
});

// Serve built client in production if client/dist exists
const clientDistDir = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistDir)) {
  app.use(express.static(clientDistDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(clientDistDir, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Only listen if executed directly
if (process.env.NODE_ENV !== 'test' && !process.argv[1]?.includes('test')) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Uploads served from ${path.join(__dirname, 'uploads')}`);
  });
}

export default app;
