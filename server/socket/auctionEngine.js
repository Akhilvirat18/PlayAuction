const Room = require('../models/Room');
const Player = require('../models/Player');
const AuctionRoom = require('../models/AuctionRoom');
const Franchise = require('../models/Franchise');
const AuctionTransaction = require('../models/AuctionTransaction');
const mongoose = require('mongoose');
const consolidatePlayers = require('../services/playerConsolidator');

// Default franchise data — used as a self-healing fallback if DB is empty
const DEFAULT_FRANCHISES = [
    { shortName: 'MI',   name: 'Mumbai Indians',           primaryColor: '#004BA0', secondaryColor: '#D1AB3E', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/c/cd/Mumbai_Indians_Logo.svg/1200px-Mumbai_Indians_Logo.svg.png' },
    { shortName: 'CSK',  name: 'Chennai Super Kings',       primaryColor: '#FFFF3C', secondaryColor: '#0081E9', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/2b/Chennai_Super_Kings_Logo.svg/1200px-Chennai_Super_Kings_Logo.svg.png' },
    { shortName: 'RCB',  name: 'Royal Challengers Bengaluru', primaryColor: '#EC1C24', secondaryColor: '#000000', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d4/Royal_Challengers_Bengaluru_Logo.svg/330px-Royal_Challengers_Bengaluru_Logo.svg.png' },
    { shortName: 'KKR',  name: 'Kolkata Knight Riders',     primaryColor: '#2E0854', secondaryColor: '#B3A123', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4c/Kolkata_Knight_Riders_Logo.svg/1200px-Kolkata_Knight_Riders_Logo.svg.png' },
    { shortName: 'DC',   name: 'Delhi Capitals',            primaryColor: '#00008B', secondaryColor: '#174796', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/2f/Delhi_Capitals.svg/500px-Delhi_Capitals.svg.png' },
    { shortName: 'PBKS', name: 'Punjab Kings',              primaryColor: '#ED1B24', secondaryColor: '#D7CA95', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d4/Punjab_Kings_Logo.svg/1200px-Punjab_Kings_Logo.svg.png' },
    { shortName: 'RR',   name: 'Rajasthan Royals',          primaryColor: '#EA1A85', secondaryColor: '#000000', purseLimit: 12000, logoUrl: 'https://scores.iplt20.com/ipl/teamlogos/RR.png' },
    { shortName: 'SRH',  name: 'Sunrisers Hyderabad',       primaryColor: '#FF822A', secondaryColor: '#000000', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/5/51/Sunrisers_Hyderabad_Logo.svg/500px-Sunrisers_Hyderabad_Logo.svg.png' },
    { shortName: 'LSG',  name: 'Lucknow Super Giants',      primaryColor: '#00D1FF', secondaryColor: '#F7A721', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/34/Lucknow_Super_Giants_Logo.svg/500px-Lucknow_Super_Giants_Logo.svg.png' },
    { shortName: 'GT',   name: 'Gujarat Titans',            primaryColor: '#1B2133', secondaryColor: '#B3975A', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/09/Gujarat_Titans_Logo.svg/1200px-Gujarat_Titans_Logo.svg.png' },
    { shortName: 'DCG',  name: 'Deccan Chargers',           primaryColor: '#D1E1EF', secondaryColor: '#263238', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/a/a6/HyderabadDeccanChargers.png' },
    { shortName: 'KTK',  name: 'Kochi Tuskers Kerala',      primaryColor: '#F15A24', secondaryColor: '#8E288E', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/9/96/Kochi_Tuskers_Kerala_Logo.svg/500px-Kochi_Tuskers_Kerala_Logo.svg.png' },
    { shortName: 'PWI',  name: 'Pune Warriors India',       primaryColor: '#40E0D0', secondaryColor: '#2C2B29', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/4/4a/Pune_Warriors_India_IPL_Logo.png' },
    { shortName: 'RPS',  name: 'Rising Pune Supergiant',    primaryColor: '#D11D70', secondaryColor: '#FCCC04', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/9/9a/Rising_Pune_Supergiant.png' },
    { shortName: 'GL',   name: 'Gujarat Lions',             primaryColor: '#E04F16', secondaryColor: '#FFA500', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/c/c4/Gujarat_Lions.png' },
];

// Self-healing: ensure the Franchise collection is never empty
async function ensureFranchisesSeeded() {
    const count = await Franchise.countDocuments();
    if (count === 0) {
        console.warn('>>> Franchise collection is empty — auto-seeding 15 franchises...');
        await Franchise.insertMany(DEFAULT_FRANCHISES);
        console.log('>>> Auto-seed complete.');
    }
}

async function fetchAllPlayers() {
    // Fetch from the correctly seeded Player collection (new_enhanced)
    // Primary sort: poolOrder (1=Marquee, etc.), Secondary sort: createdAt
    return await Player.find().sort({ poolOrder: 1, createdAt: 1 }).lean();
}

const IPL_TEAMS = [
    { id: 'MI', name: 'Mumbai Indians', color: '#004BA0', logoUrl: 'https://toppng.com/show_download/469611/mumbai-indians-vector-logo' },
    { id: 'CSK', name: 'Chennai Super Kings', color: '#FFFF3C', logoUrl: 'https://toppng.com/show_download/192192/chennai-super-kings-logo-png-csk-team-2018-players-list-free-download' },
    { id: 'RCB', name: 'Royal Challengers Bengaluru', color: '#EC1C24', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d4/Royal_Challengers_Bengaluru_Logo.svg/330px-Royal_Challengers_Bengaluru_Logo.svg.png' },
    { id: 'KKR', name: 'Kolkata Knight Riders', color: '#2E0854', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4c/Kolkata_Knight_Riders_Logo.svg/1200px-Kolkata_Knight_Riders_Logo.svg.png' },
    { id: 'DC', name: 'Delhi Capitals', color: '#00008B', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/2f/Delhi_Capitals.svg/500px-Delhi_Capitals.svg.png' },
    { id: 'PBKS', name: 'Punjab Kings', color: '#ED1B24', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d4/Punjab_Kings_Logo.svg/1200px-Punjab_Kings_Logo.svg.png' },
    { id: 'RR', name: 'Rajasthan Royals', color: '#EA1A85', logoUrl: 'https://scores.iplt20.com/ipl/teamlogos/RR.png' },
    { id: 'SRH', name: 'Sunrisers Hyderabad', color: '#FF822A', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/5/51/Sunrisers_Hyderabad_Logo.svg/500px-Sunrisers_Hyderabad_Logo.svg.png' },
    { id: 'LSG', name: 'Lucknow Super Giants', color: '#00D1FF', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/34/Lucknow_Super_Giants_Logo.svg/500px-Lucknow_Super_Giants_Logo.svg.png' },
    { id: 'GT', name: 'Gujarat Titans', color: '#1B2133', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/09/Gujarat_Titans_Logo.svg/1200px-Gujarat_Titans_Logo.svg.png' },
    { id: 'DCG', name: 'Deccan Chargers', color: '#D1E1EF', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/a/a6/HyderabadDeccanChargers.png' },
    { id: 'KTK', name: 'Kochi Tuskers Kerala', color: '#F15A24', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/9/96/Kochi_Tuskers_Kerala_Logo.svg/500px-Kochi_Tuskers_Kerala_Logo.svg.png' },
    { id: 'PWI', name: 'Pune Warriors India', color: '#40E0D0', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/4/4a/Pune_Warriors_India_IPL_Logo.png' },
    { id: 'RPS', name: 'Rising Pune Supergiant', color: '#D11D70', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/9/9a/Rising_Pune_Supergiant.png' },
    { id: 'GL', name: 'Gujarat Lions', color: '#E04F16', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/c/c4/Gujarat_Lions.png' },
]; // 15 teams

// In-memory state for timers to avoid DB writes for every second
const roomTimers = {};
const roomStates = {}; // Keep active room state in memory for fast access, flush to DB periodically / at end

function generateRoomCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Utility to calculate which franchises are still available in a room
function calculateAvailableTeams(allFranchises, takenTeams) {
    const takenIds = (takenTeams || []).map(t => String(t.franchiseId));
    return allFranchises.filter(f => !takenIds.includes(String(f._id)));
}

// Sync in-memory roomStates with DB on startup
async function initializeRoomStates(io) {
    try {
        await consolidatePlayers();     // Ensure we have players in the master collection
        await ensureFranchisesSeeded(); // Guarantee franchise data exists
        const activeRooms = await AuctionRoom.find({ status: { $ne: 'Finished' } });
        const players = await fetchAllPlayers();
        const dbFranchises = await Franchise.find();

        activeRooms.forEach(room => {
            if (!roomStates[room.roomId]) {
                roomStates[room.roomId] = {
                    roomCode: room.roomId,
                    host: room.hostSocketId,
                    hostName: room.franchisesInRoom?.[0]?.ownerName || 'Host',
                    status: room.status,
                    isPublic: room.isPublic || false,
                    maxTeams: room.maxTeams || 10,
                    players: players,
                    currentIndex: room.currentPlayerIndex || 0,
                    teams: room.franchisesInRoom || [],
                    availableTeams: calculateAvailableTeams(dbFranchises, room.franchisesInRoom || []),
                    currentBid: { amount: 0, teamId: null, teamName: null },
                    timer: 0,
                    timerDuration: 10,
                    isReAuctionRound: false
                };
            }
        });
        console.log(`>>> Recovered ${activeRooms.length} active rooms from database.`);

        // Resume timers for active rooms
        activeRooms.forEach(room => {
            if (room.status === 'Auctioning') {
                console.log(`>>> Resuming Auction Timer for Room: ${room.roomId}`);
                const state = roomStates[room.roomId];
                state.timerEndsAt = Date.now() + (state.timerDuration * 1000);
                state.timer = state.timerDuration;

                if (roomTimers[room.roomId]) clearInterval(roomTimers[room.roomId]);
                roomTimers[room.roomId] = setInterval(() => {
                    tickTimer(room.roomId, io);
                }, 500);
            }
        });
    } catch (err) {
        console.error("Failed to initialize room states:", err);
    }
}

const setupSocketHandlers = (io) => {
    // Run initialization once
    initializeRoomStates(io).then(() => {
        // Broadcast recovered rooms once initialized
        const allRooms = Object.values(roomStates).map(room => ({
            roomCode: room.roomCode,
            hostName: room.hostName,
            teamCount: room.teams.length,
            maxTeams: room.maxTeams || 10,
            isPublic: room.isPublic,
            status: room.status
        }));
        io.emit('public_rooms_list', allRooms);
    });

    // Helper to broadcast updated room list to all users in the lobby
    const broadcastPublicRooms = () => {
        const allRooms = Object.values(roomStates).map(room => ({
            roomCode: room.roomCode,
            hostName: room.hostName,
            teamCount: room.teams.length,
            maxTeams: room.maxTeams || 10,
            isPublic: room.isPublic,
            status: room.status
        }));
        console.log(`>>> Broadcasting ${allRooms.length} rooms to all clients.`);
        io.emit('public_rooms_list', allRooms);
    };
    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.id}`);

        // Send initial room list on connection
        broadcastPublicRooms();

        // Create Room (Host)
        socket.on('create_room', async ({ playerName, isPublic, maxTeams }) => {
            try {
                await ensureFranchisesSeeded(); // Guarantee franchise data exists
                const roomCode = generateRoomCode();
                const players = await fetchAllPlayers();
                const playerIds = players.map(p => p._id);
                const dbFranchises = await Franchise.find();

                const newRoom = new AuctionRoom({
                    roomId: roomCode,
                    hostSocketId: socket.id,
                    status: 'Lobby',
                    isPublic: isPublic || false,
                    maxTeams: maxTeams || 10,
                    unsoldPlayers: playerIds,
                    franchisesInRoom: [],
                    currentPlayerIndex: 0
                });
                await newRoom.save();

                socket.join(roomCode);
                socket.roomCode = roomCode; // Keep track of room for disconnect handling

                // Init high-performance memory state to prevent DB spam during fast bidding
                roomStates[roomCode] = {
                    roomCode,
                    host: socket.id,
                    hostName: playerName,
                    status: 'Lobby',
                    isPublic: isPublic || false,
                    maxTeams: maxTeams || 10,
                    players: players,
                    currentIndex: 0,
                    teams: [], // Empty initially, host must claim team from lobby
                    availableTeams: JSON.parse(JSON.stringify(dbFranchises)), // Deep copy so teams aren't globally removed
                    currentBid: { amount: 0, teamId: null, teamName: null },
                    timer: 0, // Initialize to 0, start_auction/loadNextPlayer will set it
                    timerDuration: 10, // Default 10 seconds
                    isReAuctionRound: false
                };

                socket.emit('room_created', { roomCode, state: roomStates[roomCode] });
                
                // Broadcast updated list to everyone in the lobby
                broadcastPublicRooms();
            } catch (error) {
                console.error(error);
                socket.emit('error', 'Failed to create room');
            }
        });

        socket.on('get_public_rooms', () => {
            const allRooms = Object.values(roomStates)
                .map(room => ({
                    roomCode: room.roomCode,
                    hostName: room.hostName,
                    teamCount: room.teams.length,
                    maxTeams: room.maxTeams || 10,
                    isPublic: room.isPublic,
                    status: room.status
                }));
            socket.emit('public_rooms_list', allRooms);
        });

        // Join Room
        socket.on('join_room', async ({ roomCode, playerName, isSpectator }) => {
            try {
                const state = roomStates[roomCode];
                if (!state) return socket.emit('error', 'Room not found or not active');

                const existingTeam = state.teams.find(t => t.ownerName.toLowerCase().trim() === playerName.toLowerCase().trim());
                if (state.status !== 'Lobby' && !existingTeam && !isSpectator) {
                    return socket.emit('error', 'Auction already started. New players cannot join as owners.');
                }

                socket.join(roomCode);
                socket.roomCode = roomCode; // Keep track of room for disconnect handling

                // Session Persistence: Re-link host if name matches
                if (state.hostName === playerName) {
                    console.log(`Re-linking Host: ${playerName} to Room: ${roomCode} (New Socket: ${socket.id})`);
                    state.host = socket.id;
                }

                // Re-link team if they have claimed one
                if (existingTeam) {
                    console.log(`Re-linking Owner: ${playerName} to team ${existingTeam.teamName} (New Socket: ${socket.id})`);
                    existingTeam.ownerSocketId = socket.id;
                    existingTeam.isOnline = true;
                    io.to(roomCode).emit('lobby_update', { teams: state.teams });
                }

                // Mark socket as spectator if requested
                if (isSpectator) {
                    socket.isSpectator = true;
                }

                // Do not assign team yet if they are new. Just let them in the lobby.
                socket.emit('room_joined', { roomCode, state, isSpectator: !!isSpectator });
            } catch (error) {
                console.error(error);
                socket.emit('error', 'Failed to join room');
            }
        });

        // Explicit state sync for late joiners / refreshed tabs.
        // Ensures that the same room code always resolves to the
        // exact same live player and auction state on every client.
        socket.on('request_room_state', ({ roomCode }) => {
            const state = roomStates[roomCode];
            if (!state) {
                return socket.emit('error', 'Room not found or not active');
            }

            // ALWAYS ensure the socket is actively subscribed to the live broadcasts if they are fetching state
            socket.join(roomCode);
            socket.roomCode = roomCode;

            // Robustness check: if this socket owns a team, ensure it's marked online
            const team = state.teams.find(t => t.ownerSocketId === socket.id);
            if (team && !team.isOnline) {
                team.isOnline = true;
                io.to(roomCode).emit('lobby_update', { teams: state.teams });
            }

            socket.emit('room_state_synced', { roomCode, state });
        });

        // Claim Team (Called by players from the Lobby UI)
        socket.on('claim_team', async ({ roomCode, playerName, teamId }) => {
            try {
                const state = roomStates[roomCode];
                if (!state) return socket.emit('error', 'Room not found or not active');
                if (state.status !== 'Lobby') return socket.emit('error', 'Auction already started');

                // Check if user already claimed a team
                if (state.teams.some(t => t.ownerSocketId === socket.id)) {
                    return socket.emit('error', 'You have already secured a franchise');
                }

                const teamIndex = state.availableTeams.findIndex(t => t.shortName === teamId);
                if (teamIndex === -1) return socket.emit('error', 'That franchise is already secured by another owner!');

                if (state.teams.length >= (state.maxTeams || 10)) {
                    return socket.emit('error', 'Room is full! You can only spectate.');
                }

                const assignedTeamDef = state.availableTeams.splice(teamIndex, 1)[0];

                const newTeamObj = {
                    franchiseId: assignedTeamDef._id,
                    teamName: assignedTeamDef.name,
                    teamThemeColor: assignedTeamDef.primaryColor,
                    teamLogo: assignedTeamDef.logoUrl, // Pass Logo URL to UI
                    ownerSocketId: socket.id,
                    ownerName: playerName,
                    currentPurse: assignedTeamDef.purseLimit,
                    overseasCount: 0,
                    isOnline: true,
                    rtmUsed: false,
                    playersAcquired: []
                };

                state.teams.push(newTeamObj);

                // Broadcast updated list to everyone in lobby
                socket.roomCode = roomCode; // Tracking for disconnect
                io.to(roomCode).emit('lobby_update', { teams: state.teams });
                io.to(roomCode).emit('available_teams', { teams: state.availableTeams });

                socket.emit('team_claimed_success');

                // Broadcast updated list to everyone in the lobby
                broadcastPublicRooms();

                // Update authoritative DB state asynchronously
                AuctionRoom.findOneAndUpdate({ roomId: roomCode }, { $push: { franchisesInRoom: newTeamObj } }).exec();

            } catch (error) {
                console.error(error);
                socket.emit('error', 'Failed to assign team');
            }
        });

        // Start Auction
        socket.on('start_auction', ({ roomCode }) => {
            const state = roomStates[roomCode];
            if (!state) return;
            if (state.host !== socket.id) return socket.emit('error', 'Only host can start');

            state.status = 'Auctioning';
            io.to(roomCode).emit('auction_started', { state });

            // Broadcast room status change to lobby
            broadcastPublicRooms();

            AuctionRoom.findOneAndUpdate({ roomId: roomCode }, { status: 'Auctioning' }).exec();

            // Load first player after a slight delay
            setTimeout(() => loadNextPlayer(roomCode, io), 2000);
        });

        // Place Bid
        socket.on('place_bid', ({ roomCode, amount }) => {
            const state = roomStates[roomCode];
            if (!state || state.status !== 'Auctioning') return;

            // Verify team exists and is not same as current highest bidder
            const team = state.teams.find(t => t.ownerSocketId === socket.id);
            if (!team) return socket.emit('error', 'You are not assigned to a franchise');
            if (state.currentBid.teamId === team.franchiseId) return socket.emit('error', 'You already hold the highest bid');

            // Determine Increment based on pool and current amount
            const currentPlayer = state.players[state.currentIndex];
            let minIncrement = 25; // Default 25 Lakhs for most pools

            if (currentPlayer.poolName === 'pool4') {
                if (state.currentBid.amount < 200) {
                    minIncrement = 10; // 10 Lakhs up to 2 Cr
                } else {
                    minIncrement = 25; // 25 Lakhs after 2 Cr
                }
            }

            const requiredBid = state.currentBid.amount === 0 ? currentPlayer.basePrice : state.currentBid.amount + minIncrement;

            if (amount < requiredBid) return socket.emit('error', `Minimum bid is ${requiredBid}L`);
            if (amount > team.currentPurse) return socket.emit('error', 'Insufficient purse limit');
            if (team.playersAcquired.length >= 25) return socket.emit('error', 'Squad limit reached (max 25)');

            // Overseas Limit Check
            if (currentPlayer.isOverseas && (team.overseasCount || 0) >= 8) {
                return socket.emit('error', 'Overseas player limit (8) reached for your team');
            }

            // Accept bid
            state.currentBid = { amount, teamId: team.franchiseId, teamName: team.teamName, teamColor: team.teamThemeColor, teamLogo: team.teamLogo, ownerName: team.ownerName };
            state.timerEndsAt = Date.now() + (state.timerDuration * 1000);
            state.timer = state.timerDuration; // Reset timer

            io.to(roomCode).emit('bid_placed', {
                currentBid: state.currentBid,
                timer: state.timer
            });
        });

        // --- CHAT SYSTEM ---
        socket.on('send_chat_message', ({ roomCode, message }) => {
            const state = roomStates[roomCode];
            if (!state) return;

            // Find who sent it
            const team = state.teams.find(t => t.ownerSocketId === socket.id);
            const senderName = team ? team.ownerName : 'Host';
            const senderTeam = team ? team.teamName : 'System';
            const senderColor = team ? team.teamThemeColor : '#ffffff';

            io.to(roomCode).emit('receive_chat_message', {
                id: Date.now() + Math.random(),
                senderName,
                senderTeam,
                senderColor,
                message,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        });

        // --- HOST MODERATION CONTROLS ---

        // Kick Player
        socket.on('kick_player', async ({ roomCode, targetSocketId }) => {
            const state = roomStates[roomCode];
            if (!state || state.host !== socket.id) return; // Only host can kick

            if (targetSocketId === state.host) return socket.emit('error', 'You cannot kick yourself');

            // Find if the target has claimed a team
            const teamIndex = state.teams.findIndex(t => t.ownerSocketId === targetSocketId);

            if (teamIndex !== -1) {
                const removedTeam = state.teams.splice(teamIndex, 1)[0];

                // Construct a franchise-like object to place back into availableTeams
                state.availableTeams.push({
                    _id: removedTeam.franchiseId,
                    name: removedTeam.teamName,
                    primaryColor: removedTeam.teamThemeColor,
                    logoUrl: removedTeam.teamLogo,
                    purseLimit: removedTeam.currentPurse + removedTeam.playersAcquired.reduce((sum, p) => sum + p.boughtFor, 0), // Restore full purse
                    shortName: removedTeam.teamName.split(' ').map(w => w[0]).join('') // Approx shortName
                });

                // Update Authoritative DB
                AuctionRoom.findOneAndUpdate({ roomId: roomCode }, { $pull: { franchisesInRoom: { ownerSocketId: targetSocketId } } }).exec();
            }

            // Tell target they were kicked
            io.to(targetSocketId).emit('kicked_from_room');

            // Disconnect the socket violently from the room cleanly
            const targetSocket = io.sockets.sockets.get(targetSocketId);
            if (targetSocket) targetSocket.leave(roomCode);

            // Notify everyone else
            io.to(roomCode).emit('lobby_update', { teams: state.teams });
            io.to(roomCode).emit('available_teams', { teams: state.availableTeams });
        });

        // Pause / Resume
        socket.on('pause_auction', ({ roomCode }) => {
            const state = roomStates[roomCode];
            if (!state || state.host !== socket.id) return;
            state.status = 'Paused';
            // Stop the interval timer temporarily
            if (roomTimers[roomCode]) clearInterval(roomTimers[roomCode]);
            io.to(roomCode).emit('auction_paused', { state });
        });

        socket.on('resume_auction', ({ roomCode }) => {
            const state = roomStates[roomCode];
            if (!state || state.host !== socket.id || state.status !== 'Paused') return;
            state.status = 'Auctioning';

            // Re-sync timer Ends At based on how much time was remaining
            if (state.timer > 0 && state.currentIndex < state.players.length) {
                state.timerEndsAt = Date.now() + (state.timer * 1000);

                if (roomTimers[roomCode]) clearInterval(roomTimers[roomCode]);
                roomTimers[roomCode] = setInterval(() => {
                    tickTimer(roomCode, io);
                }, 500);
            } else {
                // We were stuck in a transition or at the very beginning
                loadNextPlayer(roomCode, io);
            }

            io.to(roomCode).emit('auction_resumed', { state });
        });

        // Force End Auction Early
        socket.on('force_end_auction', ({ roomCode }) => {
            const state = roomStates[roomCode];
            if (!state || state.host !== socket.id) return;
            endAuction(roomCode, io);
        });

        // Update Room Settings (Host Only)
        socket.on('update_settings', ({ roomCode, timerDuration }) => {
            const state = roomStates[roomCode];
            if (!state || state.host !== socket.id) return;

            if ([5, 10, 15, 20].includes(timerDuration)) {
                state.timerDuration = timerDuration;
                io.to(roomCode).emit('settings_updated', { timerDuration: state.timerDuration });
                console.log(`Room ${roomCode} settings updated: timerDuration = ${timerDuration}s`);
            }
        });

        // Selection Phase Handlers
        socket.on('manual_select_playing_15', async ({ roomCode, playerIds }) => {
            const state = roomStates[roomCode];
            if (!state || state.status !== 'Selection') return;

            const teamIndex = state.teams.findIndex(t => t.ownerSocketId === socket.id);
            if (teamIndex === -1) return;

            state.teams[teamIndex].playing15 = playerIds;
            socket.emit('selection_confirmed', { playing15: playerIds });

            // Check if all teams are done
            const allDone = state.teams.every(t => t.playing15 && t.playing15.length >= 15);
            if (allDone) {
                finalizeResults(roomCode, io);
            }
        });

        socket.on('auto_select_playing_15', async ({ roomCode }) => {
            const state = roomStates[roomCode];
            if (!state || state.status !== 'Selection') return;

            const teamIndex = state.teams.findIndex(t => t.ownerSocketId === socket.id);
            if (teamIndex === -1) return;

            const team = state.teams[teamIndex];
            const { selectTop15 } = require('../services/aiRating');

            // Need full player data for AI
            const Player = require('../models/Player');
            if (!team.playersAcquired) return;

            const playersWithData = await Promise.all(team.playersAcquired.map(async (p) => {
                const data = await Player.findById(p.player);
                return { ...p, player: data };
            }));

            const selectedIds = await selectTop15(team.teamName, playersWithData);
            state.teams[teamIndex].playing15 = selectedIds;

            socket.emit('selection_confirmed', { playing15: selectedIds });

            const allDone = state.teams.every(t => t.playing15 && t.playing15.length >= 15);
            if (allDone) {
                finalizeResults(roomCode, io);
            }
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
            const roomCode = socket.roomCode;
            if (roomCode && roomStates[roomCode]) {
                const state = roomStates[roomCode];
                const team = state.teams.find(t => t.ownerSocketId === socket.id);
                if (team) {
                    team.isOnline = false;
                    // Broadcast that someone went offline
                    io.to(roomCode).emit('lobby_update', { teams: state.teams });
                }
            }
        });

    });
};

function loadNextPlayer(roomCode, io) {
    const state = roomStates[roomCode];
    if (!state || state.status !== 'Auctioning') return;

    if (state.currentIndex >= state.players.length) {
        handleAuctionEndTransition(roomCode, io);
        return;
    }

    const player = state.players[state.currentIndex];
    const nextPlayers = state.players.slice(state.currentIndex + 1, state.currentIndex + 11);

    state.currentBid = { amount: 0, teamId: null, teamName: null, teamColor: null, teamLogo: null, ownerName: null };
    state.timerEndsAt = Date.now() + (state.timerDuration * 1000);
    state.timer = state.timerDuration;

    io.to(roomCode).emit('new_player', { player, nextPlayers, timer: state.timer });

    if (roomTimers[roomCode]) clearInterval(roomTimers[roomCode]);

    roomTimers[roomCode] = setInterval(() => {
        tickTimer(roomCode, io);
    }, 500);
}

function tickTimer(roomCode, io) {
    const state = roomStates[roomCode];
    if (!state || state.status !== 'Auctioning') {
        if (roomTimers[roomCode]) clearInterval(roomTimers[roomCode]);
        return;
    }

    const remainingSeconds = Math.max(0, Math.ceil((state.timerEndsAt - Date.now()) / 1000));

    // Only emit if the integer second has changed to avoid spamming the client
    if (state.timer !== remainingSeconds) {
        state.timer = remainingSeconds;
        io.to(roomCode).emit('timer_tick', { timer: state.timer });
    }

    if (state.timer <= 0) {
        clearInterval(roomTimers[roomCode]);
        processHammerDown(roomCode, io);
    }
}

async function processHammerDown(roomCode, io) {
    const state = roomStates[roomCode];
    const player = state.players[state.currentIndex];

    const playerName = player.player || player.name || 'Unknown Player';

    if (state.currentBid.amount > 0) {
        // Player Sold
        const winningTeamIndex = state.teams.findIndex(t => t.franchiseId === state.currentBid.teamId);
        let winningSocketId = null;

        if (winningTeamIndex !== -1) {
            state.teams[winningTeamIndex].currentPurse -= state.currentBid.amount;
            if (player.isOverseas) {
                state.teams[winningTeamIndex].overseasCount = (state.teams[winningTeamIndex].overseasCount || 0) + 1;
            }
            state.teams[winningTeamIndex].playersAcquired.push({
                player: player._id,
                name: playerName,
                isOverseas: player.isOverseas,
                boughtFor: state.currentBid.amount
            });
            winningSocketId = state.teams[winningTeamIndex].ownerSocketId;
        }

        // --- Structured JSON Logging for Backend ---
        const soldData = {
            event: "PLAYER_SOLD",
            timestamp: new Date().toISOString(),
            player: {
                id: player._id,
                name: playerName,
                basePrice: player.basePrice
            },
            winningBid: {
                amount: state.currentBid.amount,
                team: state.currentBid.teamName,
                owner: state.currentBid.ownerName
            }
        };
        console.log(JSON.stringify(soldData, null, 2));

        io.to(roomCode).emit('player_sold', {
            player: { ...player, name: playerName },
            winningBid: state.currentBid,
            teams: state.teams
        });

        // Persist Transaction Record
        try {
            await AuctionTransaction.create({
                roomId: roomCode,
                playerId: player._id,
                soldPrice: state.currentBid.amount,
                soldToTeamId: state.currentBid.teamId,
                soldToSocketId: winningSocketId,
                status: 'sold',
                bidHistory: [{
                    bidderTeamId: state.currentBid.teamId,
                    bidAmount: state.currentBid.amount
                }]
            });

            // Update Authoritative Room State
            await AuctionRoom.findOneAndUpdate({ roomId: roomCode }, {
                $set: { franchisesInRoom: state.teams, currentPlayerIndex: state.currentIndex + 1 },
                $pull: { unsoldPlayers: player._id }
            });

            // CHECK: Auto-stop if every team has 25 players
            const ALL_SQUADS_FULL = state.teams.every(t => t.playersAcquired.length >= 25);
            if (ALL_SQUADS_FULL) {
                console.log(`\n--- ALL SQUADS FULL (25 players each) in Room ${roomCode} ---`);
                handleAuctionEndTransition(roomCode, io);
                return; // Stop further processing for this player
            }
        } catch (err) {
            console.error("Critical DB Persistence Error on SOLD:", err.message);
        }

    } else {
        // Player Unsold
        io.to(roomCode).emit('player_unsold', { player });

        try {
            await AuctionTransaction.create({
                roomId: roomCode,
                playerId: player._id,
                status: 'unsold'
            });
            await AuctionRoom.findOneAndUpdate({ roomId: roomCode }, {
                $set: { currentPlayerIndex: state.currentIndex + 1 }
            });
        } catch (err) {
            console.error("Critical DB Persistence Error on UNSOLD:", err.message);
        }
    }

    state.currentIndex += 1;

    // Wait 3 seconds before advancing podium
    setTimeout(() => {
        loadNextPlayer(roomCode, io);
    }, 3000);
}

async function handleAuctionEndTransition(roomCode, io) {
    const state = roomStates[roomCode];
    if (!state) return;

    // Check if there are unsold players and if we already did re-auction
    if (!state.isReAuctionRound) {
        const allSoldPlayerIds = state.teams.flatMap(t => t.playersAcquired.map(p => String(p.player)));
        const unsoldPlayers = state.players.filter(p => !allSoldPlayerIds.includes(String(p._id)));

        if (unsoldPlayers.length > 0) {
            console.log(`\n--- STARTING RE-AUCTION ROUND FOR ${unsoldPlayers.length} UNSOLD PLAYERS ---`);
            state.isReAuctionRound = true;
            state.players = unsoldPlayers;
            state.currentIndex = 0;

            io.to(roomCode).emit('receive_chat_message', {
                id: Date.now(),
                senderName: 'System',
                senderTeam: 'System',
                senderColor: '#ff0000',
                message: "Starting re-auction round for all unsold players!",
                timestamp: new Date().toLocaleTimeString()
            });

            setTimeout(() => loadNextPlayer(roomCode, io), 3000);
            return;
        }
    }

    // If no unsold players or already finished re-auction
    endAuction(roomCode, io);
}

async function endAuction(roomCode, io) {
    const state = roomStates[roomCode];
    if (!state) return;

    // Transition to Selection Phase instead of Finished
    state.status = 'Selection';
    state.selectionTimer = 120; // 2 minutes
    state.selectionTimerEndsAt = Date.now() + 120000;

    console.log(`\n--- TRANSITIONING TO SELECTION PHASE FOR ROOM ${roomCode} ---`);

    // Ensure 15 player minimum as before
    const allSoldPlayerIds = state.teams.flatMap(t => t.playersAcquired.map(p => String(p.player)));
    const remainingUnsold = state.players.filter(p => !allSoldPlayerIds.includes(String(p._id)));

    // Emit transition to selection phase
    io.to(roomCode).emit('auction_finished', { teams: state.teams, status: 'Selection' });

    try {
        await AuctionRoom.findOneAndUpdate({ roomId: roomCode }, {
            status: 'Selection',
            franchisesInRoom: state.teams
        });
    } catch (err) {
        console.error("Error transitioning to selection:", err);
    }

    if (roomTimers[roomCode]) clearInterval(roomTimers[roomCode]);
    roomTimers[roomCode] = setInterval(() => {
        tickSelectionTimer(roomCode, io);
    }, 1000);
}

function tickSelectionTimer(roomCode, io) {
    const state = roomStates[roomCode];
    if (!state || state.status !== 'Selection') {
        if (roomTimers[roomCode]) {
            clearInterval(roomTimers[roomCode]);
            delete roomTimers[roomCode];
        }
        return;
    }

    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((state.selectionTimerEndsAt - now) / 1000));

    // Only update and emit if the timer value actually changed
    if (state.selectionTimer !== remaining) {
        state.selectionTimer = remaining;
        io.to(roomCode).emit('selection_timer_tick', { timer: state.selectionTimer });
    }

    if (state.selectionTimer <= 0) {
        if (roomTimers[roomCode]) {
            clearInterval(roomTimers[roomCode]);
            delete roomTimers[roomCode];
        }
        finalizeResults(roomCode, io);
    }
}

async function finalizeResults(roomCode, io) {
    const state = roomStates[roomCode];
    if (!state) return;

    state.status = 'Finished';

    try {
        const { evaluateAllTeams } = require('../services/aiRating');
        const Player = require('../models/Player');

        // 1. Prepare teams with full player data for AI
        const teamsToEvaluate = await Promise.all(state.teams.map(async (team) => {
            const playersWithData = await Promise.all(team.playersAcquired.map(async (p) => {
                const data = await Player.findById(p.player).lean(); // Use lean() for plain JS object
                return {
                    id: String(p.player),
                    name: data?.player || data?.name || p.name,
                    role: data?.role,
                    nationality: data?.nationality,
                    boughtFor: p.boughtFor,
                    stats: data?.stats || {}
                };
            }));

            // Fallback for playing15 if not set
            const playing15 = (team.playing15 && team.playing15.length > 0)
                ? team.playing15.map(id => String(id))
                : team.playersAcquired.slice(0, 15).map(p => String(p.player));

            return {
                teamName: team.teamName,
                currentPurse: team.currentPurse,
                playersAcquired: playersWithData,
                playing15: playing15
            };
        }));

        // 2. Perform AI Evaluation (Unbiased & Persisted)
        console.log(`--- EVALUATING TEAMS FOR ROOM ${roomCode} ---`);
        const evaluatedResults = await evaluateAllTeams(teamsToEvaluate);

        // 3. Merge results back into original state.teams to preserve all metadata
        state.teams = state.teams.map(originalTeam => {
            const evalResult = evaluatedResults.find(r => r.teamName === originalTeam.teamName);
            return {
                ...originalTeam,
                evaluation: evalResult?.evaluation,
                rank: evalResult?.rank
            };
        });

        // 4. Persistence
        await AuctionRoom.findOneAndUpdate({ roomId: roomCode }, {
            status: 'Finished',
            franchisesInRoom: state.teams
        });

        console.log(`--- PERSISTED RESULTS FOR ROOM ${roomCode} ---`);
        io.to(roomCode).emit('results_ready');

    } catch (err) {
        console.error("Critical Error in finalizeResults:", err);
        io.to(roomCode).emit('error', 'Failed to generate final results');
    }

    delete roomTimers[roomCode];
}

module.exports = setupSocketHandlers;
