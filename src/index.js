require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const postsRoutes = require('./routes/posts');

const PORT = process.env.PORT || 4000;

async function start() {
  await connectDB(process.env.MONGO_URI);

  const app = express();
  app.use(express.json());
  app.use(require('cookie-parser')());

  app.use('/api/auth', authRoutes);
  app.use('/api/posts', postsRoutes);

  // scheduler (auto-start)
  require('./scheduler/scheduler');

  app.get('/', (req, res) => res.send('LinkedIn Automation Backend is running'));

  app.listen(PORT, () => console.log(`🚀 Server listening http://localhost:${PORT}`));
}

start();
