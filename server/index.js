const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
const allowedOrigins = [
    'https://play-auction-wii2.vercel.app', // The new deployed URL
    'https://play-auction-l8u7.vercel.app',
    'https://play-auction-l8u7-akhils-projects-b24479e3.vercel.app', 
    'http://localhost:5173',
    'http://localhost:5174'
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`Blocked by CORS: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express.json()); // Body parser

const server = http.createServer(app);

const setupSocketHandlers = require('./socket/auctionEngine');

const apiRoutes = require('./routes/api');

// Setup Socket.io
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['polling', 'websocket'], // Try polling first then upgrade
    allowEIO3: true // Support older clients if any
});

setupSocketHandlers(io);

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
    res.send('IPL Auction Server API is running');
});

app.get('/ping', (req, res) => {
    res.send('pong');
});

// Start listening
const PORT = process.env.PORT || 5050;
server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});

// Export io so it can be used in socket handlers
module.exports = { io };

// Global Error Handlers for Production Stability
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception thrown:', err);
    // On uncaught exception, it's often safer to exit and let the orchestrator (Render) restart the service
    process.exit(1);
});
