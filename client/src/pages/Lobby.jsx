import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check } from 'lucide-react';

const IPL_TEAMS = [
    { id: 'MI', name: 'Mumbai Indians', color: '#004BA0', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/c/cd/Mumbai_Indians_Logo.svg/1200px-Mumbai_Indians_Logo.svg.png' },
    { id: 'CSK', name: 'Chennai Super Kings', color: '#FFFF3C', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/2b/Chennai_Super_Kings_Logo.svg/1200px-Chennai_Super_Kings_Logo.svg.png' },
    { id: 'RCB', name: 'Royal Challengers Bengaluru', color: '#EC1C24', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d4/Royal_Challengers_Bengaluru_Logo.svg/330px-Royal_Challengers_Bengaluru_Logo.svg.png' },
    { id: 'KKR', name: 'Kolkata Knight Riders', color: '#2E0854', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4c/Kolkata_Knight_Riders_Logo.svg/1200px-Kolkata_Knight_Riders_Logo.svg.png' },
    { id: 'DC', name: 'Delhi Capitals', color: '#00008B', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/2f/Delhi_Capitals.svg/500px-Delhi_Capitals.svg.png' },
    { id: 'PBKS', name: 'Punjab Kings', color: '#ED1B24', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d4/Punjab_Kings_Logo.svg/1200px-Punjab_Kings_Logo.svg.png' },
    { id: 'RR', name: 'Rajasthan Royals', color: '#EA1A85', logoUrl: 'https://scores.iplt20.com/ipl/teamlogos/RR.png' },
    { id: 'SRH', name: 'Sunrisers Hyderabad', color: '#FF822A', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/5/51/Sunrisers_Hyderabad_Logo.svg/500px-Sunrisers_Hyderabad_Logo.svg.png' },
    { id: 'LSG', name: 'Lucknow Super Giants', color: '#00D1FF', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a9/Lucknow_Super_Giants_IPL_Logo.svg/1200px-Lucknow_Super_Giants_IPL_Logo.svg.png' },
    { id: 'GT', name: 'Gujarat Titans', color: '#1B2133', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/09/Gujarat_Titans_Logo.svg/1200px-Gujarat_Titans_Logo.svg.png' },
    { id: 'DCG', name: 'Deccan Chargers', color: '#D1E1EF', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/a/a6/HyderabadDeccanChargers.png' },
    { id: 'KTK', name: 'Kochi Tuskers Kerala', color: '#F15A24', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/9/96/Kochi_Tuskers_Kerala_Logo.svg/500px-Kochi_Tuskers_Kerala_Logo.svg.png' },
    { id: 'PWI', name: 'Pune Warriors India', color: '#40E0D0', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/4/4a/Pune_Warriors_India_IPL_Logo.png' },
    { id: 'RPS', name: 'Rising Pune Supergiant', color: '#D11D70', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/9/9a/Rising_Pune_Supergiant.png' },
    { id: 'GL', name: 'Gujarat Lions', color: '#E04F16', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/c/c4/Gujarat_Lions.png' },
];

const Lobby = () => {
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [playerName, setPlayerName] = useState(localStorage.getItem('playerName') || '');
    const [roomCodeInput, setRoomCodeInput] = useState('');
    const [isJoined, setIsJoined] = useState(false);
    const [roomState, setRoomState] = useState(null);
    const [timerDuration, setTimerDuration] = useState(10);
    const [error, setError] = useState('');

    const [joinMode, setJoinMode] = useState(false);
    const [availableTeamsForRoom, setAvailableTeamsForRoom] = useState(null);
    const [isPublic, setIsPublic] = useState(false);
    const [maxTeams, setMaxTeams] = useState(10);
    const [publicRooms, setPublicRooms] = useState([]);
    const [isSpectator, setIsSpectator] = useState(false);
    
    // New UI states for Search & Filter
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('All'); // 'All', 'Public', 'Private'
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const socket = useSocket();
    const navigate = useNavigate();

    useEffect(() => {
        if (!socket) return;

        socket.on('room_created', ({ roomCode, state }) => {
            setRoomState(state);
            setIsJoined(true);
            setError('');
        });

        socket.on('room_joined', ({ roomCode, state, isSpectator: joinedAsSpectator }) => {
            setRoomState(state);
            setIsJoined(true);
            setIsSpectator(!!joinedAsSpectator);
            setError('');
            localStorage.setItem('lastRoomCode', roomCode);

            // Redirect if auction is already in progress
            if (state.status === 'Auctioning' || state.status === 'Paused') {
                navigate(`/auction/${roomCode}`, { state: { roomState: state } });
            } else if (state.status === 'Selection') {
                navigate(`/selection/${roomCode}`);
            } else if (state.status === 'Finished') {
                navigate(`/results/${roomCode}`);
            }
        });

        socket.on('public_rooms_list', (rooms) => {
            setPublicRooms(rooms);
        });

        socket.on('lobby_update', ({ teams }) => {
            setRoomState(prev => prev ? { ...prev, teams } : null);
        });

        socket.on('available_teams', ({ teams }) => {
            setAvailableTeamsForRoom(teams);
            setError('');
        });

        socket.on('error', (msg) => {
            setError(msg);
            if (msg.includes('Room not found')) {
                localStorage.removeItem('lastRoomCode');
            }
        });

        socket.on('auction_started', ({ state }) => {
            navigate(`/auction/${state.roomCode}`, { state: { roomState: state } });
        });

        socket.on('kicked_from_room', () => {
            setIsJoined(false);
            setRoomState(null);
            setHasClaimedTeam(false);
            setError('You have been removed from the room by the host.');
        });

        socket.on('settings_updated', ({ timerDuration }) => {
            setTimerDuration(timerDuration);
        });
        return () => {
            socket.off('room_created');
            socket.off('room_joined');
            socket.off('lobby_update');
            socket.off('available_teams');
            socket.off('error');
            socket.off('auction_started');
            socket.off('kicked_from_room');
            socket.off('settings_updated');
            socket.off('public_rooms_list');
        };
    }, [socket, navigate]);

    useEffect(() => {
        if (socket && !isJoined) {
            socket.emit('get_public_rooms');

            // Auto-reconnect if we have a saved room
            const lastRoomCode = localStorage.getItem('lastRoomCode');
            if (lastRoomCode && playerName) {
                socket.emit('join_room', { roomCode: lastRoomCode, playerName });
            }

            const interval = setInterval(() => {
                socket.emit('get_public_rooms');
            }, 10000);
            return () => clearInterval(interval);
        }
    }, [socket, isJoined, playerName]);

    useEffect(() => {
        if (playerName) {
            localStorage.setItem('playerName', playerName);
        }
    }, [playerName]);

    const handleCreate = () => {
        if (!playerName) return setError('Please enter your name');
        socket.emit('create_room', { playerName, isPublic, maxTeams });
    };

    const handleJoin = (spectate = false, manualCode = null) => {
        const codeToUse = manualCode || roomCodeInput;
        if (!playerName || !codeToUse) return setError('Name and Room Code required');
        socket.emit('join_room', { roomCode: codeToUse, playerName, isSpectator: spectate });
    };

    const handleClaimTeam = () => {
        if (!selectedTeamId) return setError('Select a franchise first');
        socket.emit('claim_team', { roomCode: roomState.roomCode, playerName, teamId: selectedTeamId });
    };

    const handleStart = () => {
        socket.emit('start_auction', { roomCode: roomState.roomCode });
    };

    const handleCopyCode = () => {
        if (!roomState?.roomCode) return;
        navigator.clipboard.writeText(roomState.roomCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const myTeam = roomState?.teams?.find(t => t.ownerSocketId === socket.id);
    const hasClaimedTeam = !!myTeam;

    // Filter Logic for Room Directory
    const filteredRooms = publicRooms.filter(room => {
        const matchesSearch = room.roomCode.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (room.hostName || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterType === 'All' || 
                             (filterType === 'Public' && room.isPublic) || 
                             (filterType === 'Private' && !room.isPublic);
        return matchesSearch && matchesFilter;
    });

    // Use available teams from state if present, otherwise fallback to IPL_TEAMS
    const displayTeams = availableTeamsForRoom || IPL_TEAMS;

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 lg:p-6 relative overflow-hidden bg-[#0a0a0f]">

            {/* Background elements - Stadium Night Scene */}
            <div
                className="absolute inset-0 z-0 pointer-events-none"
                style={{
                    backgroundImage: 'url("https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=3000&auto=format&fit=crop")',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    filter: 'brightness(0.55) contrast(1.1) saturate(1.2)'
                }}
            ></div>
            <div className="absolute inset-0 z-0 bg-gradient-to-b from-purple-900/10 via-[#0a0a0f]/40 to-[#0a0a0f] pointer-events-none"></div>

            <div className="w-full max-w-5xl flex flex-col items-center relative z-10 pt-8 lg:pt-0 pb-10">

                {/* Title Section */}
                <motion.div
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="mb-8 lg:mb-16 text-center"
                >
                    <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black italic tracking-tighter leading-none uppercase"
                        style={{
                            background: 'linear-gradient(to bottom, #FFF7D6, #FFDF73, #D4AF37, #997A00)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            filter: 'drop-shadow(0px 8px 4px rgba(0,0,0,0.8))'
                        }}
                    >
                        IPL AUCTION
                    </h1>
                </motion.div>

                {/* Main Content Area */}
                <div className="w-full max-w-xl flex flex-col items-center">

                    {/* Interaction Card Side */}
                    <motion.div
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="w-full"
                    >
                        <div className="rounded-[24px] lg:rounded-[32px] p-6 lg:p-10 relative overflow-hidden bg-black/40 border border-[#D4AF37]/30 shadow-[0_0_30px_rgba(212,175,55,0.05)] backdrop-blur-md">
                            <AnimatePresence mode="wait">
                                {!isJoined ? (
                                    <motion.div
                                        key="entry"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                    >
                                        <div className="space-y-6">
                                            {/* Gaffer Name Input */}
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">The Gaffer's Name</label>
                                                <input
                                                    type="text"
                                                    placeholder="Enter your name..."
                                                    className="w-full bg-[#12121a]/80 border border-white/5 rounded-2xl px-6 py-4 focus:outline-none focus:border-[#D4AF37]/50 text-white font-bold transition-all placeholder:text-slate-600 shadow-inner"
                                                    value={playerName}
                                                    onChange={(e) => setPlayerName(e.target.value)}
                                                />
                                            </div>

                                            {/* Create Room Button */}
                                            <button
                                                onClick={handleCreate}
                                                className="w-full py-5 rounded-3xl bg-transparent border border-[#d4af37] text-[#d4af37] font-black tracking-[0.2em] uppercase text-xs lg:text-sm hover:bg-[#d4af37]/10 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-[0_0_15px_rgba(212,175,55,0.1)]"
                                            >
                                                CREATE NEW ROOM
                                            </button>

                                            {/* Divider */}
                                            <div className="flex items-center gap-4 py-2">
                                                <div className="h-[1px] flex-1 bg-white/10"></div>
                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Or Join Existing</span>
                                                <div className="h-[1px] flex-1 bg-white/10"></div>
                                            </div>

                                            {/* Join Existing Area */}
                                            <div className="flex gap-3">
                                                <input
                                                    type="text"
                                                    placeholder="ENTER ROOM CODE"
                                                    className="flex-1 bg-[#12121a]/80 border border-white/5 rounded-2xl text-center px-4 py-4 focus:outline-none focus:border-blue-500/50 text-white font-black tracking-widest uppercase transition-all placeholder:text-slate-600 shadow-inner"
                                                    value={roomCodeInput}
                                                    onChange={(e) => setRoomCodeInput(e.target.value)}
                                                />
                                                <button
                                                    onClick={() => handleJoin()}
                                                    className="px-8 rounded-2xl bg-[#2563eb] text-white font-black tracking-widest uppercase text-xs lg:text-sm hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                                                >
                                                    JOIN
                                                </button>
                                            </div>
                                        </div>

                                        {error && (
                                            <motion.p 
                                                initial={{ opacity: 0 }} 
                                                animate={{ opacity: 1 }} 
                                                className="text-red-500 text-[10px] font-black uppercase tracking-widest text-center mt-6 bg-red-500/5 py-3 rounded-2xl border border-red-500/10"
                                            >
                                                {error}
                                            </motion.p>
                                        )}
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="lobby"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="space-y-6 lg:space-y-8"
                                    >
                                        <div className="text-center relative group">
                                            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2">Room Assigned</h2>
                                            <div className="flex items-center justify-center gap-4">
                                                <div className="text-4xl lg:text-5xl font-black text-[#D4AF37] tracking-[0.1em] drop-shadow-[0_0_15px_rgba(212,175,55,0.4)]">{roomState.roomCode}</div>
                                                <button
                                                    onClick={handleCopyCode}
                                                    className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-[#D4AF37] hover:border-[#D4AF37]/50 transition-all active:scale-90"
                                                    title="Copy Room Code"
                                                >
                                                    {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                                                </button>
                                            </div>
                                            {copied && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] font-black text-green-500 uppercase tracking-widest"
                                                >
                                                    Code Copied!
                                                </motion.div>
                                            )}
                                        </div>

                                        {!hasClaimedTeam ? (
                                            <div className="space-y-4">
                                                <h3 className="text-[10px] font-black text-[#3b82f6] uppercase tracking-widest text-center">Step 2: Claim Your Franchise</h3>
                                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2 pb-2">
                                                    {IPL_TEAMS.map(team => {
                                                        const tId = team.id;
                                                        const isClaimed = roomState?.teams?.some(t => t.teamName === team.name);

                                                        return (
                                                            <button
                                                                key={tId}
                                                                onClick={() => {
                                                                    if (!isClaimed) setSelectedTeamId(tId);
                                                                }}
                                                                disabled={isClaimed}
                                                                className={`p-2 rounded-xl border text-[9px] font-black tracking-wider uppercase transition-all flex flex-col items-center justify-center gap-2 relative overflow-hidden
                                                                    ${isClaimed
                                                                        ? 'bg-black/40 border-slate-800 opacity-50 cursor-not-allowed grayscale'
                                                                        : selectedTeamId === tId
                                                                            ? 'bg-[#D4AF37]/20 border-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.3)] scale-105 z-10'
                                                                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                                                                    }`}
                                                            >
                                                                {isClaimed && (
                                                                    <div className="absolute inset-0 bg-red-900/20 flex items-center justify-center backdrop-blur-[1px] z-20">
                                                                        <span className="bg-red-600 text-white text-[8px] px-2 py-0.5 rounded shadow-lg transform -rotate-12">CLAIMED</span>
                                                                    </div>
                                                                )}
                                                                <img src={team.logoUrl} alt={tId} className={`w-10 h-10 object-contain drop-shadow-lg ${isClaimed ? 'opacity-40' : ''}`} />
                                                                <span className={`truncate w-full text-center ${isClaimed ? 'text-slate-600 line-through' : 'text-slate-300'}`}>{tId}</span>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                                <button onClick={handleClaimTeam} className="w-full bg-[#3b82f6] text-white font-black py-3 rounded-xl hover:bg-blue-500 transition-all uppercase tracking-widest text-[10px] mt-2">
                                                    SECURE FRANCHISE
                                                </button>
                                                {error && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest text-center">{error}</p>}
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Connected Owners</h3>
                                                <div className="grid grid-cols-2 gap-3 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                                                    {roomState.teams.map((t, i) => (
                                                        <div key={i} className="bg-white/5 p-3 lg:p-4 rounded-xl lg:rounded-2xl border border-white/10 flex items-center gap-2 lg:gap-3 relative">
                                                            <div className="w-1 lg:w-1.5 h-6 rounded-full" style={{ backgroundColor: t.teamThemeColor }}></div>

                                                            {t.teamLogo ? (
                                                                <div className="w-6 h-6 lg:w-8 lg:h-8 rounded-full bg-white/5 flex items-center justify-center p-0.5 lg:p-1 border border-white/10 shrink-0">
                                                                    <img src={t.teamLogo} alt={t.teamName} className="w-full h-full object-contain" />
                                                                </div>
                                                            ) : (
                                                                <div className="w-6 h-6 lg:w-8 lg:h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
                                                                    <span className="text-[8px] lg:text-[10px] font-black text-white">{t.teamName.charAt(0)}</span>
                                                                </div>
                                                            )}

                                                            <div className="flex-1 overflow-hidden pr-4">
                                                                <div className="text-[8px] lg:text-[9px] font-black text-white uppercase truncate">{t.teamName}</div>
                                                                <div className="text-[8px] lg:text-[10px] text-slate-500 font-bold truncate">{t.ownerName} {t.ownerSocketId === roomState.host && '(Host)'}</div>
                                                            </div>

                                                            {((roomState.host === socket.id) || (playerName && roomState.hostName === playerName)) && t.ownerSocketId !== socket.id && (
                                                                <button
                                                                    onClick={() => {
                                                                        if (window.confirm(`Are you sure you want to kick ${t.ownerName} from the room?`)) {
                                                                            socket.emit('kick_player', { roomCode: roomState.roomCode, targetSocketId: t.ownerSocketId });
                                                                        }
                                                                    }}
                                                                    className="absolute top-1.5 lg:top-2 right-1.5 lg:right-2 text-slate-500 hover:text-red-500 bg-black/20 hover:bg-red-500/10 w-5 h-5 lg:w-6 lg:h-6 rounded-full flex items-center justify-center transition-all"
                                                                    title="Kick Player"
                                                                >
                                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                                                    </svg>
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                {((roomState.host === socket.id) || (playerName && roomState.hostName === playerName)) && (
                                                    <div className="mt-6 lg:mt-8 space-y-3 lg:space-y-4">
                                                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Auction Timer Settings</h3>
                                                        <div className="flex gap-4">
                                                            {[5, 10].map(sec => (
                                                                <button
                                                                    key={sec}
                                                                    onClick={() => socket.emit('update_settings', { roomCode: roomState.roomCode, timerDuration: sec })}
                                                                    className={`flex-1 py-2.5 lg:py-3 rounded-xl border font-black uppercase tracking-widest text-[9px] lg:text-[10px] transition-all
                                                                        ${timerDuration === sec
                                                                            ? 'bg-[#3b82f6] border-[#3b82f6] text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                                                                            : 'bg-transparent border-white/20 text-slate-500 hover:border-white/40'}`}
                                                                >
                                                                    {sec} Seconds
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {((roomState.host === socket.id) || (playerName && roomState.hostName === playerName)) ? (
                                                    <button
                                                        onClick={handleStart}
                                                        className="w-full py-4 mt-4 lg:mt-6 rounded-full bg-[#D4AF37] text-black font-black uppercase tracking-widest text-xs lg:text-sm hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-[0_0_20px_rgba(212,175,55,0.4)]"
                                                    >
                                                        Initiate Auction Loop
                                                    </button>
                                                ) : (
                                                    <div className="w-full p-6 rounded-2xl bg-white/5 border border-white/10 text-center mt-4">
                                                        <div className="text-white/30 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Waiting for host to start...</div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </div>

                {/* Pills at the bottom aligned center */}
                <motion.div
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="flex flex-wrap justify-center gap-4 mt-12 lg:mt-16"
                >
                    <div className="px-5 py-2.5 lg:py-3 rounded-full border border-green-500/30 bg-black/40 backdrop-blur-sm flex items-center gap-2.5 lg:gap-3 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                        <div className="w-1.5 lg:w-2 h-1.5 lg:h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-slate-300">Low Latency Engine</span>
                    </div>
                    <div className="px-5 py-2.5 lg:py-3 rounded-full border border-blue-500/30 bg-black/40 backdrop-blur-sm flex items-center gap-2.5 lg:gap-3 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                        <div className="w-1.5 lg:w-2 h-1.5 lg:h-2 rounded-full bg-blue-500 animate-pulse"></div>
                        <span className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-slate-300">Gemini AI Ratings</span>
                    </div>
                </motion.div>

            </div>
        </div>
    );
};

export default Lobby;
