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
app.use(cors());
app.use(express.json()); // Body parser

const server = http.createServer(app);

const setupSocketHandlers = require('./socket/auctionEngine');

const apiRoutes = require('./routes/api');

// Setup Socket.io
const io = new Server(server, {
    cors: {
        origin: '*', // For dev, allow all
        methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling'] // Explicitly allow both for proxies like Render
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
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});

// Export io so it can be used in socket handlers
module.exports = { io };
