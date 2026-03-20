import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import { ImAirplane } from "react-icons/im";
import GavelSlam from '../components/GavelSlam';
import { TeamList, BidHistory, ChatSection } from '../components/AuctionSubComponents';

import { playBidSound, playWarningBeep } from '../utils/soundEngine';

const AuctionPodium = () => {
    const { roomCode } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const socket = useSocket();

    const [gameState, setGameState] = useState(location.state?.roomState || null);
    const [playerName] = useState(localStorage.getItem('playerName') || 'Anonymous');
    
    // Initialize currentPlayer from state passed via navigate if available
    const [currentPlayer, setCurrentPlayer] = useState(() => {
        const initialS = location.state?.roomState;
        if (initialS?.players && typeof initialS.currentIndex === 'number') {
            return initialS.players[initialS.currentIndex] || null;
        }
        return null;
    });
    const [currentBid, setCurrentBid] = useState({ amount: 0, teamId: null, teamName: null, teamColor: null });
    const [timer, setTimer] = useState(10);
    const [myTeam, setMyTeam] = useState(null);
    const [soldEvent, setSoldEvent] = useState(null);
    const [isPaused, setIsPaused] = useState(false);
    const [activeTab, setActiveTab] = useState('podium'); // 'teams', 'podium', 'chat'
    const [reconnectError, setReconnectError] = useState(false);
    const [copied, setCopied] = useState(false);

    const [activeTeams, setActiveTeams] = useState(gameState?.teams || []);
    const [recentSold, setRecentSold] = useState([]); // Track last 10 sold players
    const [allPlayersMap, setAllPlayersMap] = useState({});

    useEffect(() => {
        // Fetch players to create a fallback name map in case backend only sends IDs
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5050';
        fetch(`${apiUrl}/api/players`)
            .then(res => res.json())
            .then(data => {
                if (!Array.isArray(data)) throw new Error("Invalid player data format");
                const map = {};
                data.forEach(p => {
                    map[p._id] = p.name || p.player;
                    if (p.playerId) map[p.playerId] = p.name || p.player;
                });
                setAllPlayersMap(map);
            })
            .catch(err => {
                console.warn("Falling back for player map:", err.message);
                setAllPlayersMap({});
            });
    }, []);

    // Hard sync with the authoritative live room state whenever
    // the podium mounts or a tab reconnects. This guarantees that
    // every client looking at the same room code sees the exact
    // same player and auction snapshot, even after refreshes.
    // 1. Initial Sync & Recovery (Runs on mount/reconnect)
    // 1. Initial Sync & Recovery (Runs on mount/reconnect)
    useEffect(() => {
        if (!socket || !roomCode) return;

        const handleSync = ({ state }) => {
            if (!state) {
                setReconnectError(true);
                return;
            }
            setReconnectError(false);
            setGameState(state);
            setActiveTeams(state.teams || []);
            setCurrentBid(state.currentBid || { amount: 0, teamId: null, teamName: null, teamColor: null });
            
            if (state.players && typeof state.currentIndex === 'number') {
                setCurrentPlayer(state.players[state.currentIndex] || null);
            }
            
            setIsPaused(state.status === 'Paused');
            setTimer(state.timer || state.timerDuration || 10);

            // Re-link myTeam
            const linkedTeam = (state.teams || []).find(
                t => t.ownerSocketId === socket.id || t.ownerName === playerName
            );
            if (linkedTeam) setMyTeam(linkedTeam);
        };

        const handleError = (msg) => {
            console.error("Podium Sync Error:", msg);
            if (!gameState) setReconnectError(true);
        };

        const handleConnect = () => {
            socket.emit('request_room_state', { roomCode });
            socket.emit('join_room', { roomCode, playerName });
        };

        socket.on('room_state_synced', handleSync);
        socket.on('room_joined', handleSync);
        socket.on('error', handleError);
        socket.on('connect', handleConnect);

        // Proactively request sync if already connected
        if (socket.connected) {
            handleConnect();
        }

        return () => {
            socket.off('room_state_synced', handleSync);
            socket.off('room_joined', handleSync);
            socket.off('error', handleError);
            socket.off('connect', handleConnect);
        };
    }, [socket, roomCode, playerName]); 
    const [bidHistory, setBidHistory] = useState([]);
    const [expandedTeamId, setExpandedTeamId] = useState(null);
    const [allSoldPlayers, setAllSoldPlayers] = useState([]); // { player, winningBid }
    const [allUnsoldPlayers, setAllUnsoldPlayers] = useState([]); // player objects

    // Chat State
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const chatEndRef = useRef(null);

    // Options Menu State
    const [showOptionsPopup, setShowOptionsPopup] = useState(false);
    const [showPoolNumbers, setShowPoolNumbers] = useState(false);
    const [poolTab, setPoolTab] = useState('upcoming'); // 'upcoming' | 'sold' | 'unsold'
    // Note: optionsPopupRef no longer used for click-outside — the modal has a backdrop + X button
    const optionsPopupRef = useRef(null);

    const { upcomingPoolName, currentPoolTitle, playersInCurrentPool } = useMemo(() => {
        let upcoming = 'None';
        let current = 'None';
        let currentPoolPlayers = [];

        if (gameState && currentPlayer && currentPlayer.poolName) {
            const currentName = currentPlayer.poolName;
            current = currentName.toLowerCase().startsWith('pool') ? `Pool ${currentName.replace(/pool/i, '')}` : currentName;
            
            const remainingPlayers = gameState.players.slice(gameState.currentIndex + 1);
            
            // Include both the currentPlayer AND upcoming players in the same pool
            currentPoolPlayers = [
                currentPlayer,
                ...remainingPlayers.filter(p => p.poolName === currentPlayer.poolName)
            ];
            
            // Deterministically shuffle so it's "random" but doesn't jump on every state update
            currentPoolPlayers.sort((a, b) => {
                const hash = (str) => {
                    let h = 0;
                    for (let i = 0; i < str.length; i++) {
                        h = Math.imul(31, h) + str.charCodeAt(i) | 0;
                    }
                    return h;
                };
                return hash(a._id || a.name || '') - hash(b._id || b.name || '');
            });

            const nextTarget = remainingPlayers.find(p => p.poolName && p.poolName !== currentPlayer.poolName);
            
            if (nextTarget && nextTarget.poolName) {
                const upcomingName = nextTarget.poolName;
                upcoming = upcomingName.toLowerCase().startsWith('pool') ? `Pool ${upcomingName.replace(/pool/i, '')}` : upcomingName;
            }
        }

        return { upcomingPoolName: upcoming, currentPoolTitle: current, playersInCurrentPool: currentPoolPlayers };
    }, [gameState, currentPlayer]);

    const activeStats = useMemo(() => {
        if (!currentPlayer) return [];
        const role = currentPlayer.role?.toLowerCase() || '';
        const s = currentPlayer.stats || {};
        
        if (role.includes('wicket') || role.includes('wk')) {
            return [
                { label: 'Matches', val: s.matches, color: 'text-white' },
                { label: 'S.Rate', val: s.strikeRate, color: 'text-yellow-400' },
                { label: 'Bat Avg', val: s.battingAvg, color: 'text-white' },
                { label: 'Highest', val: s.highestScore, color: 'text-orange-400' },
                { label: 'Runs', val: s.runs, color: 'text-blue-400' },
                { label: 'Stumps', val: s.stumpings, color: 'text-teal-400' },
                { label: 'Catches', val: s.catches, color: 'text-green-400' }
            ];
        }
        
        if (role.includes('batsman') || role.includes('batsmen') || role.includes('batting')) {
            return [
                { label: 'Matches', val: s.matches, color: 'text-white' },
                { label: 'S.Rate', val: s.strikeRate, color: 'text-yellow-400' },
                { label: 'Bat Avg', val: s.battingAvg, color: 'text-white' },
                { label: 'Highest', val: s.highestScore, color: 'text-orange-400' },
                { label: 'Runs', val: s.runs, color: 'text-blue-400' }
            ];
        }
        
        if (role.includes('bowler') || role.includes('bowling')) {
            return [
                { label: 'Economy', val: s.economy, color: 'text-pink-400' },
                { label: 'Bowl Avg', val: s.bowlingAvg, color: 'text-purple-200' },
                { label: 'Wickets', val: s.wickets, color: 'text-purple-400' },
                { label: 'Matches', val: s.matches, color: 'text-white' },
                { label: 'Best', val: s.bestBowling, color: 'text-indigo-400' }
            ];
        }
        
        if (role.includes('all-rounder') || role.includes('allround')) {
            return [
                { label: 'Matches', val: s.matches, color: 'text-white' },
                { label: 'Runs', val: s.runs, color: 'text-blue-400' },
                { label: 'S.Rate', val: s.strikeRate, color: 'text-yellow-400' },
                { label: 'Highest', val: s.highestScore, color: 'text-orange-400' },
                { label: 'Wickets', val: s.wickets, color: 'text-purple-400' },
                { label: 'Economy', val: s.economy, color: 'text-pink-400' },
                { label: 'Best', val: s.bestBowling, color: 'text-indigo-400' },
                { label: 'Bat Avg', val: s.battingAvg, color: 'text-white' },
                { label: 'Bowl Avg', val: s.bowlingAvg, color: 'text-purple-200' }
            ];
        }
        
        return [
            { label: 'Matches', val: s.matches, color: 'text-white' },
            { label: 'Runs', val: s.runs, color: 'text-blue-400' },
            { label: 'Wickets', val: s.wickets, color: 'text-purple-400' }
        ];
    }, [currentPlayer]);

    // Scroll chat to bottom when new messages arrive
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    // 3D Card Tilt Logic
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const mouseXSpring = useSpring(x);
    const mouseYSpring = useSpring(y);
    const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
    const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

    const handleMouseMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        x.set(mouseX / width - 0.5);
        y.set(mouseY / height - 0.5);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    // 1b. Re-link myTeam locally whenever gameState changes
    useEffect(() => {
        if (!socket || !gameState) return;
        const team = (gameState.teams || []).find(t => t.ownerSocketId === socket.id || t.ownerName === playerName);
        if (team) setMyTeam(team);
    }, [gameState, socket, playerName]);

    // 2. Live Auction Event Listeners
    useEffect(() => {
        if (!socket) return;

        const handleLobbyUpdate = ({ teams }) => {
            if (teams) {
                setActiveTeams(teams);
                setGameState(prev => prev ? { ...prev, teams } : null);
            }
        };

        const handleNewPlayer = ({ player, nextPlayers, timer }) => {
            setCurrentPlayer(player);
            setTimer(timer);
            setCurrentBid({ amount: 0, teamId: null, teamName: null, teamColor: null });
            setSoldEvent(null);
            setBidHistory([]);
            setGameState(prev => {
                if (!prev) return prev;
                const players = prev.players || [];
                const idx = players.findIndex(p => p._id === player._id);
                return idx >= 0 ? { ...prev, currentIndex: idx } : prev;
            });
            if (nextPlayers && nextPlayers.length > 0) {
                nextPlayers.forEach(p => {
                    const imgUrl = p.imagepath || p.image_path || p.photoUrl;
                    if (imgUrl) { const img = new Image(); img.src = imgUrl; }
                });
            }
        };

        const handleTimerTick = ({ timer }) => {
            setTimer((prevTimer) => {
                if (timer > 0 && timer <= 3 && timer !== prevTimer) playWarningBeep();
                return timer;
            });
        };

        const handleBidPlaced = ({ currentBid, timer }) => {
            setCurrentBid(currentBid);
            setTimer(timer);
            setBidHistory(prev => [
                { id: Date.now(), ...currentBid, time: new Date().toLocaleTimeString() },
                ...prev
            ]);
            playBidSound();
        };

        const handlePlayerSold = ({ player, winningBid, teams }) => {
            console.log("🔥 PLAYER SOLD 🔥", player.name || player.player, "→", winningBid.teamName);
            setSoldEvent({ type: 'SOLD', player, winningBid });
            setActiveTeams(teams);
            setRecentSold(prev => [
                { name: player.player || player.name, team: winningBid.teamName, price: winningBid.amount },
                ...prev
            ].slice(0, 10));
            // NOTE: allSoldPlayers tracking is in the dedicated stable useEffect below
            const updatedMyTeam = teams.find(t => t.ownerSocketId === socket.id);
            if (updatedMyTeam) setMyTeam(updatedMyTeam);
        };

        const handlePlayerUnsold = ({ player }) => {
            setSoldEvent({ type: 'UNSOLD', player });
            // NOTE: allUnsoldPlayers tracking is in the dedicated stable useEffect below
        };

        const handleAuctionFinished = ({ teams, status }) => {
            setTimeout(() => {
                if (status === 'Selection') {
                    navigate(`/selection/${roomCode}`);
                } else {
                    navigate(`/results/${roomCode}`, { state: { finalTeams: teams } });
                }
            }, 3000);
        };

        const handleChatMessage = (msg) => setChatMessages(prev => [...prev, msg]);

        socket.on('lobby_update', handleLobbyUpdate);
        socket.on('new_player', handleNewPlayer);
        socket.on('timer_tick', handleTimerTick);
        socket.on('bid_placed', handleBidPlaced);
        socket.on('player_sold', handlePlayerSold);
        socket.on('player_unsold', handlePlayerUnsold);
        socket.on('auction_finished', handleAuctionFinished);
        socket.on('auction_paused', () => setIsPaused(true));
        socket.on('auction_resumed', () => setIsPaused(false));
        socket.on('kicked_from_room', () => navigate('/'));
        socket.on('receive_chat_message', handleChatMessage);

        return () => {
            socket.off('lobby_update', handleLobbyUpdate);
            socket.off('new_player', handleNewPlayer);
            socket.off('timer_tick', handleTimerTick);
            socket.off('bid_placed', handleBidPlaced);
            socket.off('player_sold', handlePlayerSold);
            socket.off('player_unsold', handlePlayerUnsold);
            socket.off('auction_finished', handleAuctionFinished);
            socket.off('auction_paused');
            socket.off('auction_resumed');
            socket.off('kicked_from_room');
            socket.off('receive_chat_message', handleChatMessage);
        };
    }, [socket, navigate, roomCode]);

    // ─── Dedicated stable listeners for sold/unsold pool tracking ───
    // Kept in a separate effect with [] deps so they NEVER re-register
    // and therefore NEVER miss an event due to gameState-triggered effect restarts.
    useEffect(() => {
        if (!socket) return;

        const onSold = ({ player, winningBid }) => {
            setAllSoldPlayers(prev => [{ player, winningBid }, ...prev]);
        };
        const onUnsold = ({ player }) => {
            setAllUnsoldPlayers(prev => [player, ...prev]);
        };

        socket.on('player_sold', onSold);
        socket.on('player_unsold', onUnsold);

        return () => {
            socket.off('player_sold', onSold);
            socket.off('player_unsold', onUnsold);
        };
    }, [socket]);

    if (!gameState) return <div className="text-white flex items-center justify-center h-screen bg-darkBg">
        <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-white/10 border-t-white rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 font-bold tracking-widest uppercase text-xs">
                {reconnectError ? "Room not found or session expired..." : "Authenticating Lobby..."}
            </p>
            {reconnectError && (
                <button 
                    onClick={() => navigate('/')}
                    className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
                >
                    Back to Lobby
                </button>
            )}
        </div>
    </div>;

    // Dynamic Increment Logic
    const getMinIncrement = () => {
        if (!currentPlayer) return 25;
        if (currentPlayer.poolName === 'pool4') {
            return currentBid.amount < 200 ? 10 : 25;
        }
        return 25; // Default for other pools
    };

    const minIncrement = getMinIncrement();
    const targetAmount = currentBid.amount === 0 ? (currentPlayer?.basePrice || 50) : currentBid.amount + minIncrement;

    const handleBid = useCallback(() => {
        if (!myTeam || timer <= 0 || soldEvent || isPaused) return;
        socket.emit('place_bid', { roomCode, amount: targetAmount });
    }, [myTeam, timer, soldEvent, isPaused, socket, roomCode, targetAmount]);

    const handleCopyCode = () => {
        if (!roomCode) return;
        navigator.clipboard.writeText(roomCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSendMessage = useCallback((e) => {
        if (e && e.preventDefault) e.preventDefault();
        
        // Handle both standard form events and custom picker objects
        const messageText = (e && e.customMessage) ? e.customMessage : chatInput.trim();
        
        if (!messageText) return;
        
        socket.emit('send_chat_message', { roomCode, message: messageText });
        
        // Only clear input if it wasn't a direct sticker send
        if (!(e && e.customMessage)) {
            setChatInput("");
        }
    }, [chatInput, socket, roomCode]);

    const ringRadius = 45;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const maxTimer = gameState?.timerDuration || 10;
    const timerDashoffset = ringCircumference - (timer / maxTimer) * ringCircumference;

    let timerColor = '#00d2ff';
    if (timer <= 5) timerColor = '#ffcc33';
    if (timer <= 3) timerColor = '#ef4444';

    const getShortRole = (role) => {
        if (!role) return '';
        const r = role.toLowerCase();
        if (r.includes('all-rounder') || r.includes('all rounder')) return 'AR';
        if (r.includes('bowler')) return 'Bowl';
        if (r.includes('batsman') || r.includes('batter')) return 'Bat';
        if (r.includes('wicket') || r.includes('keeper') || r.includes('wk')) return 'WK';
        return role;
    };

    const getShortNation = (nation) => {
        if (!nation) return '';
        const n = nation.toLowerCase().trim();
        const mapping = {
            'india': 'IND',
            'south africa': 'SA',
            'england': 'ENG',
            'australia': 'AUS',
            'new zealand': 'NZ',
            'sri lanka': 'SL',
            'west indies': 'WI',
            'pakistan': 'PAK',
            'afghanistan': 'AFG',
            'bangladesh': 'BAN',
            'ireland': 'IRE',
            'zimbabwe': 'ZIM',
            'netherlands': 'NED',
        };
        return mapping[n] || nation.substring(0, 3).toUpperCase();
    };

    return (
        <div className="h-[100dvh] w-full flex flex-col lg:flex-row bg-darkBg overflow-hidden text-white font-sans selection:bg-white/20 pt-safe pb-safe">

            {/* Cinematic Background Elements */}
            <div className="fixed inset-0 pointer-events-none opacity-40">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[150px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[150px] rounded-full"></div>
            </div>

            {/* Left Sidebar: Franchises (Responsive) */}
            <AnimatePresence>
                {(activeTab === 'teams' || window.innerWidth >= 1024) && (
                    <motion.div
                        initial={{ x: -300 }}
                        animate={{ x: 0 }}
                        exit={{ x: -300 }}
                        className={`
                            fixed inset-0 lg:relative lg:flex lg:w-64 xl:w-80 glass-panel flex-col pt-8 z-[60] lg:z-10 shadow-2xl transition-all
                            ${activeTab === 'teams' ? 'flex' : 'hidden lg:flex'}
                        `}
                    >
                        <div className="px-6 mb-6 flex justify-between items-center">
                            <div>
                                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">Live Budgets</h2>
                                <div className="h-0.5 w-10 bg-white/10"></div>
                            </div>
                            <button onClick={() => setActiveTab('podium')} className="lg:hidden text-slate-500 text-xs font-black uppercase tracking-widest">Close</button>
                        </div>
                        <TeamList
                            teams={activeTeams}
                            currentBidTeamId={currentBid.teamId}
                            expandedTeamId={expandedTeamId}
                            setExpandedTeamId={setExpandedTeamId}
                            allPlayersMap={allPlayersMap}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Auction Arena */}
            <div className="flex-1 flex flex-col relative overflow-hidden">
                <canvas id="podium-confetti" className="absolute inset-0 w-full h-full pointer-events-none z-[110]"></canvas>

                {/* Premium Live Auction Ticker (Moved to Top) */}
                <div className="absolute top-0 left-0 right-0 h-8 bg-black/60 backdrop-blur-md border-b border-white/10 z-[100] flex items-center overflow-hidden">
                    <div className="bg-blue-600 h-full px-4 flex items-center justify-center z-10 shadow-[5px_0_15px_rgba(0,0,0,0.5)]">
                        <span className="text-[7px] lg:text-[9px] font-black uppercase tracking-[0.2em] whitespace-nowrap text-white">Live Highlights</span>
                    </div>

                    <div className="flex-1 relative overflow-hidden h-full flex items-center">
                        <div className="flex whitespace-nowrap animate-ticker group-hover:pause">
                            {[...Array(2)].map((_, loopIdx) => (
                                <React.Fragment key={`loop-${loopIdx}`}>
                                    {recentSold.map((s, i) => (
                                        <div key={`recent-${loopIdx}-${i}`} className="inline-flex items-center mx-8">
                                            <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest mr-2">RECENT:</span>
                                            <span className="text-[10px] font-bold text-white uppercase">{s.name}</span>
                                            <span className="mx-2 text-slate-500">→</span>
                                            <span className="text-[10px] font-black text-yellow-500 uppercase">{s.team}</span>
                                            <span className="ml-2 text-[10px] font-mono font-black text-white/50">₹{s.price}L</span>
                                        </div>
                                    ))}

                                    {activeTeams.flatMap(t => t.playersAcquired.map(p => ({ ...p, team: t.teamName })))
                                        .sort((a, b) => b.boughtFor - a.boughtFor)
                                        .slice(0, 10)
                                        .map((s, i) => (
                                            <div key={`top-${loopIdx}-${i}`} className="inline-flex items-center mx-8">
                                                <span className="text-[8px] font-black text-purple-400 uppercase tracking-widest mr-2">TOP BUY:</span>
                                                <span className="text-[10px] font-bold text-white uppercase">{s.name}</span>
                                                <span className="mx-2 text-slate-500">→</span>
                                                <span className="text-[10px] font-black text-blue-400 uppercase">{s.team}</span>
                                                <span className="ml-2 text-[10px] font-mono font-black text-white/50">₹{s.boughtFor}L</span>
                                            </div>
                                        ))}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sub-Header: Room Info & Host Controls (Moved below Highlights) */}
                <div className="absolute top-8 left-0 right-0 h-8 lg:h-10 bg-black/30 backdrop-blur-sm border-b border-white/5 z-[90] flex items-center px-2 lg:px-6 gap-1.5 lg:gap-3">
                    <button
                        onClick={handleCopyCode}
                        className="px-1.5 py-0.5 lg:px-3 lg:py-1 rounded-md bg-white/5 border border-white/10 text-[6px] lg:text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap flex items-center gap-1.5 hover:bg-white/10 transition-all active:scale-95"
                        title="Copy Room Code"
                    >
                        Room: {roomCode}
                        {copied ? <Check size={10} className="text-green-500" /> : <Copy size={10} />}
                    </button>
                    <div className="px-1.5 py-0.5 lg:px-3 lg:py-1 rounded-md border border-red-500/20 bg-red-500/5 text-red-500 text-[6px] lg:text-[9px] font-black uppercase tracking-widest flex items-center gap-1 lg:gap-1.5 whitespace-nowrap">
                        <div className="w-1 h-1 lg:w-1.5 lg:h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                        Live
                    </div>

                    {/* Host Controls */}
                    {(gameState?.host === socket?.id || (playerName && gameState?.hostName === playerName)) && (
                        <div className="flex items-center gap-1 lg:gap-2">
                            <button
                                onClick={() => socket.emit(isPaused ? 'resume_auction' : 'pause_auction', { roomCode })}
                                className={`px-2 py-0.5 lg:px-4 lg:py-1 rounded-md font-black uppercase tracking-widest text-[6px] lg:text-[9px] transition-all flex items-center justify-center gap-1 lg:gap-1.5 shadow-md ${isPaused ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-yellow-600/20 text-yellow-500 border border-yellow-500/30 backdrop-blur-md'}`}
                            >
                                {isPaused ? <span className="w-1 h-1 lg:w-1.5 lg:h-1.5 bg-white rounded-full"></span> : <span className="w-1 h-1 lg:w-1.5 lg:h-1.5 bg-yellow-500 rounded-full"></span>}
                                {isPaused ? 'Resume' : 'Pause'}
                            </button>
                            <button
                                onClick={() => {
                                    if (window.confirm("End auction?")) {
                                        socket.emit('force_end_auction', { roomCode });
                                    }
                                }}
                                className="px-2 py-0.5 lg:px-4 lg:py-1 rounded-md bg-red-600/20 text-red-500 border border-red-500/30 backdrop-blur-md transition-all flex items-center justify-center gap-1 lg:gap-1.5 text-[6px] lg:text-[9px] font-black uppercase tracking-widest shadow-md hover:bg-red-600 hover:text-white"
                            >
                                End
                            </button>
                        </div>
                    )}

                    {/* Options Button (Hamburger) */}
                    <div ref={optionsPopupRef} className="ml-auto flex items-center">
                        <button
                            onClick={() => setShowOptionsPopup(!showOptionsPopup)}
                            className={`p-1 lg:px-3 lg:py-1.5 rounded-md transition-all flex flex-col justify-center items-center gap-[1.5px] lg:gap-[3px] border border-white/10 backdrop-blur-md shadow-lg ${showOptionsPopup ? 'bg-blue-600 border-blue-400' : 'bg-slate-800/40 hover:bg-slate-700'}`}
                            title="Player Pools"
                        >
                            <div className="w-2.5 lg:w-4 h-[1px] lg:h-[2px] bg-white rounded-full"></div>
                            <div className="w-2.5 lg:w-4 h-[1px] lg:h-[2px] bg-white rounded-full"></div>
                            <div className="w-2.5 lg:w-4 h-[1px] lg:h-[2px] bg-white rounded-full"></div>
                        </button>
                    </div>
                </div>

                {/* Player Pools Modal Overlay */}
                <AnimatePresence>
                    {showOptionsPopup && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
                            onClick={() => setShowOptionsPopup(false)}
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.93, y: 24 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.93, y: 24 }}
                                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                                className="w-full max-w-2xl glass-panel border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col select-none"
                                style={{ maxHeight: '85dvh' }}
                                onClick={e => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="px-7 pt-6 pb-4 shrink-0" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(168,85,247,0.10) 100%)' }}>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="text-xl font-black text-white uppercase tracking-widest">Player Pools</div>
                                            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.25em] mt-1">Auction Sequence Preview</div>
                                        </div>
                                        <button
                                            onClick={() => setShowOptionsPopup(false)}
                                            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all text-slate-400 hover:text-white shrink-0 mt-0.5"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                    <div className="h-px mt-4" style={{ background: 'linear-gradient(90deg, #6366f1, #a855f7, transparent)' }}></div>
                                </div>

                                {/* Tabs */}
                                <div className="flex border-b border-white/5 shrink-0">
                                    {[['upcoming', 'Live & Upcoming'], ['sold', 'Sold History'], ['unsold', 'Unsold']].map(([key, label]) => (
                                        <button
                                            key={key}
                                            onClick={() => setPoolTab(key)}
                                            className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest transition-all border-b-2 ${
                                                poolTab === key
                                                    ? 'text-white border-blue-500 bg-blue-500/10'
                                                    : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-white/3'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>

                                {/* Scrollable Content */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar">

                                    {/* ── Live & Upcoming ── */}
                                    {poolTab === 'upcoming' && (() => {
                                        const allPlayers = gameState?.players || [];
                                        // Derive live index from currentPlayer ID — more reliable than gameState.currentIndex
                                        // which can be stale between new_player firing and gameState re-syncing.
                                        const liveIdx = currentPlayer
                                            ? allPlayers.findIndex(p => p._id === currentPlayer._id)
                                            : (gameState?.currentIndex ?? -1);
                                        // Only show players STRICTLY AFTER the current one on the block
                                        const remainingPlayers = allPlayers.filter((p, idx) => idx > liveIdx);
                                        const groupedPools = remainingPlayers.reduce((acc, p) => {
                                            const key = p.poolName || 'Default';
                                            if (!acc[key]) acc[key] = [];
                                            acc[key].push(p);
                                            return acc;
                                        }, {});

                                        return (
                                            <div className="pb-6">
                                                {/* Current Player */}
                                                {currentPlayer && (
                                                    <div className="px-6 pt-5 pb-4">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shrink-0"></span>
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Current Auction</span>
                                                        </div>
                                                        <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-3.5">
                                                            <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-800 border-2 border-blue-500/50 shrink-0 shadow-[0_0_16px_rgba(99,102,241,0.4)]">
                                                                <img src={currentPlayer.image_path || currentPlayer.imagepath || currentPlayer.photoUrl || 'https://via.placeholder.com/100'} alt={currentPlayer.player || currentPlayer.name} className="w-full h-full object-cover object-top" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-base font-black text-white uppercase tracking-tight truncate">{currentPlayer.player || currentPlayer.name}</div>
                                                                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                                                                    {currentPlayer.role || 'Player'} · {currentPlayer.poolName ? (currentPlayer.poolName.toLowerCase().startsWith('pool') ? `Pool ${currentPlayer.poolName.replace(/pool/i, '')}` : currentPlayer.poolName) : ''}
                                                                </div>
                                                            </div>
                                                            <div className="text-base font-black font-mono text-blue-400 shrink-0">₹{currentPlayer.basePrice || '?'}L</div>
                                                        </div>
                                                        <div className="h-px mt-4 bg-white/5"></div>
                                                    </div>
                                                )}

                                                {/* Pool Groups — only upcoming players, current player excluded */}
                                                {Object.entries(groupedPools).map(([poolName, players]) => (
                                                    <div key={poolName} className="px-6 mb-4">
                                                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] text-center mb-3 flex items-center justify-center gap-2">
                                                            <span>{poolName.toLowerCase().startsWith('pool') ? `Pool ${poolName.replace(/pool/i, '')}` : poolName}</span>
                                                            <span className="bg-white/5 border border-white/5 px-1.5 py-0.5 rounded text-slate-600 font-black text-[8px]">{players.length}</span>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {players.map((p) => (
                                                                <div key={p._id} className="flex items-center gap-2 rounded-xl p-2 border bg-white/3 border-white/5 hover:bg-white/6 transition-all">
                                                                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-white/10 bg-slate-800">
                                                                        <img src={p.image_path || p.imagepath || p.photoUrl || 'https://via.placeholder.com/80'} alt={p.player || p.name} className="w-full h-full object-cover object-top" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="text-[9px] font-bold text-slate-200 uppercase truncate leading-tight">{p.player || p.name}</div>
                                                                        <div className="text-[8px] font-black font-mono text-slate-500 mt-0.5">₹{p.basePrice || '?'}L</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Empty state: all remaining players have been auctioned */}
                                                {Object.keys(groupedPools).length === 0 && (
                                                    <div className="flex flex-col items-center justify-center py-12 text-slate-600 gap-2">
                                                        {currentPlayer
                                                            ? <div className="text-[10px] font-black uppercase tracking-widest">Last player on the block</div>
                                                            : <div className="text-[10px] font-black uppercase tracking-widest">All players auctioned</div>
                                                        }
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* ── Sold History ── */}
                                    {poolTab === 'sold' && (() => {
                                        // Group sold players by their pool
                                        const groupedSold = allSoldPlayers.reduce((acc, { player, winningBid }) => {
                                            const key = player.poolName || 'Default';
                                            if (!acc[key]) acc[key] = [];
                                            acc[key].push({ player, winningBid });
                                            return acc;
                                        }, {});

                                        return (
                                            <div className="pb-6">
                                                <div className="px-6 pt-4">
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <span className="w-2 h-2 bg-green-500 rounded-full shrink-0"></span>
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Completed Auctions</span>
                                                    </div>
                                                </div>

                                                {allSoldPlayers.length === 0 ? (
                                                    <div className="text-center py-12 text-slate-600 text-[10px] font-black uppercase tracking-widest italic px-4">No players sold yet in this session.</div>
                                                ) : (
                                                    Object.entries(groupedSold).map(([poolName, items]) => (
                                                        <div key={poolName} className="px-6 mb-4">
                                                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] text-center mb-3">
                                                                {poolName.toLowerCase().startsWith('pool') ? `Pool ${poolName.replace(/pool/i, '')}` : poolName}
                                                            </div>
                                                            <div className="grid grid-cols-3 gap-2">
                                                                {items.map(({ player: p, winningBid }, i) => {
                                                                    const teamColor = activeTeams.find(t => t.teamName === winningBid?.teamName)?.teamThemeColor || '#60a5fa';
                                                                    return (
                                                                        <div key={p._id || i} className="flex items-center gap-2 rounded-xl p-2 bg-green-500/5 border border-green-500/10 hover:bg-green-500/8 transition-all">
                                                                            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-white/10 bg-slate-800">
                                                                                <img src={p.image_path || p.imagepath || p.photoUrl || 'https://via.placeholder.com/80'} alt={p.player || p.name} className="w-full h-full object-cover object-top" />
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="text-[9px] font-bold text-slate-200 uppercase truncate leading-tight">{p.player || p.name}</div>
                                                                                <div className="text-[8px] font-black font-mono mt-0.5" style={{ color: teamColor }}>₹{winningBid?.amount || '?'}L</div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* ── Unsold ── */}
                                    {poolTab === 'unsold' && (() => {
                                        const groupedUnsold = allUnsoldPlayers.reduce((acc, p) => {
                                            const key = p.poolName || 'Default';
                                            if (!acc[key]) acc[key] = [];
                                            acc[key].push(p);
                                            return acc;
                                        }, {});

                                        return (
                                            <div className="pb-6">
                                                <div className="px-6 pt-4">
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <span className="w-2 h-2 bg-red-500 rounded-full shrink-0"></span>
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Unsold Catalog</span>
                                                    </div>
                                                </div>

                                                {allUnsoldPlayers.length === 0 ? (
                                                    <div className="text-center py-12 text-slate-600 text-[10px] font-black uppercase tracking-widest italic px-4">No unsold players yet.</div>
                                                ) : (
                                                    Object.entries(groupedUnsold).map(([poolName, players]) => (
                                                        <div key={poolName} className="px-6 mb-4">
                                                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] text-center mb-3">
                                                                {poolName.toLowerCase().startsWith('pool') ? `Pool ${poolName.replace(/pool/i, '')}` : poolName}
                                                            </div>
                                                            <div className="grid grid-cols-3 gap-2">
                                                                {players.map((p, i) => (
                                                                    <div key={p._id || i} className="flex items-center gap-2 rounded-xl p-2 bg-red-500/5 border border-red-500/10 hover:bg-red-500/8 transition-all">
                                                                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-white/10 bg-slate-800">
                                                                            <img src={p.image_path || p.imagepath || p.photoUrl || 'https://via.placeholder.com/80'} alt={p.player || p.name} className="w-full h-full object-cover object-top" />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="text-[9px] font-bold text-slate-200 uppercase truncate leading-tight">{p.player || p.name}</div>
                                                                            <div className="text-[8px] font-black font-mono text-red-400 mt-0.5">₹{p.basePrice || '?'}L</div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Footer */}
                                <div className="px-7 py-3 border-t border-white/5 shrink-0 bg-black/20">
                                    <div className="text-[8px] text-slate-600 font-black uppercase tracking-widest text-center">
                                        Catalog reflects the official IPL 2025 sequence logic
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>




                <div className="flex-1 flex items-center justify-center p-4 lg:p-12 z-10 overflow-hidden">
                    <AnimatePresence mode='wait'>
                        {!currentPlayer ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center"
                            >
                                <div className="text-sm xs:text-base lg:text-4xl font-black text-white/10 uppercase tracking-[0.3em] lg:tracking-[0.5em] animate-pulse">Preparing Podium...</div>
                            </motion.div>
                        ) : (
                                <div className="flex flex-col lg:flex-row items-center justify-start lg:justify-center w-full max-w-7xl gap-4 lg:gap-4 xl:gap-[2vw] pb-6 lg:pb-4 pt-[77px] lg:pt-20 min-h-0 overflow-hidden">
                                    
                                    {/* Player Info Left & Photo Duo */}
                                    <div className="flex items-center gap-2 lg:gap-8 shrink-0 relative">
                                        

                                        {/* Premium Player Card (Further Shrunk) */}
                                        <motion.div
                                            key={currentPlayer._id}
                                            layout
                                            style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
                                            onMouseMove={handleMouseMove}
                                            onMouseLeave={handleMouseLeave}
                                            initial={{ opacity: 0, scale: 0.9, y: 40 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.9, y: -40 }}
                                            transition={{ type: "spring", stiffness: 300, damping: 25, mass: 1 }}
                                            className="w-[173px] xs:w-[213px] sm:w-[273px] lg:w-[min(340px,35vh)] xl:w-[min(420px,40vh)] aspect-[3/4.2] glass-card rounded-[14px] lg:rounded-[24px] relative overflow-hidden group shadow-[0_15px_35px_rgba(0,0,0,0.6)] border border-white/10 shrink-0 flex flex-col bg-slate-900"
                                        >
                                            {/* Image Section */}
                                            <div className="relative h-full w-full overflow-hidden">
                                                <motion.img
                                                    initial={{ scale: 1.1 }}
                                                    animate={{ scale: 1 }}
                                                    transition={{ duration: 0.8 }}
                                                    src={currentPlayer.image_path || currentPlayer.imagepath || currentPlayer.photoUrl || 'https://via.placeholder.com/400x600?text=No+Photo'}
                                                    alt={currentPlayer.player || currentPlayer.name || 'Player'}
                                                    className="w-full h-full object-cover object-top"
                                                />
                                                
                                                {/* Overlays */}
                                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80"></div>
                                                
                                                {/* Name & Sub-info Container (Combined) */}
                                                <div className="absolute bottom-3 lg:bottom-12 left-1.5 lg:left-4 right-1.5 lg:right-4 z-20 flex flex-col items-start px-1 lg:px-0">
                                                    <h1 className="text-[16px] xs:text-[18px] lg:text-[14px] font-black italic tracking-tighter leading-none text-white uppercase drop-shadow-[0_4px_10px_rgba(0,0,0,0.7)] mb-1">
                                                        {(currentPlayer.player || currentPlayer.name || 'Unknown').split(' ').map((n, i) => (
                                                            <span key={i} className="block">{n}</span>
                                                        ))}
                                                    </h1>
                                                    
                                                    <div className="flex flex-row items-center gap-1.5 lg:gap-3 text-white/80 drop-shadow-md">
                                                        <div className="text-[6px] lg:text-[11px] font-black uppercase tracking-widest">{getShortRole(currentPlayer.role)}</div>
                                                        <div className="h-1.5 lg:h-2.5 w-px bg-white/20"></div>
                                                        <div className="text-[6px] lg:text-[11px] font-black uppercase tracking-widest flex items-center gap-0.5 lg:gap-1">
                                                            <span>{getShortNation(currentPlayer.nationality)}</span>
                                                            {currentPlayer.isOverseas && <ImAirplane className="text-blue-400/80 -rotate-45" size={window.innerWidth < 1024 ? 4 : 7} />}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    </div>

                                {/* Stats & Bidding Arena */}
                                <div className="flex-1 flex flex-col justify-center w-full min-w-0 px-2 lg:px-0 lg:-mt-6">
                                    {/* Responsive Stats Grid – matching Image 2 (3-column grid on mobile) */}
                                    <div className="grid grid-cols-3 lg:grid-cols-4 gap-1 lg:gap-1.5 justify-center lg:justify-start mb-2 lg:mb-4 mt-2 lg:mt-0 max-h-[25vh] lg:max-h-none overflow-y-auto lg:overflow-visible pr-1">
                                        {activeStats.map((stat, idx) => (
                                             <div
                                                 key={idx}
                                                 className={`h-[28px] xs:h-[36px] lg:h-[min(55px,8vh)] rounded-lg lg:rounded-[10px] border border-white/10 bg-white/5 flex flex-col items-center justify-center px-1.5 lg:px-3 xl:px-4 shadow-2xl backdrop-blur-md transition-all hover:bg-white/10 active:scale-95 
                                                     ${idx === activeStats.length - 1 && activeStats.length % 3 !== 0 ? 'col-start-2 lg:col-start-auto' : ''}`}
                                             >
                                                 <div className="text-[5px] xs:text-[6px] lg:text-[8px] text-slate-500 font-black uppercase tracking-[0.1em] lg:tracking-[0.15em] leading-none mb-0.5 lg:mb-1">
                                                     {stat.label}
                                                 </div>
                                                 <div className={`text-[9px] xs:text-[11px] lg:text-[18px] font-black font-mono leading-none ${stat.color}`}>
                                                     {stat.val || 0}
                                                 </div>
                                             </div>
                                         ))}
                                     </div>

                                    {/* Bidding Core (Optimized for Image 2 parity) */}
                                    <div className="flex flex-row lg:flex-col items-center lg:items-start justify-between lg:justify-start gap-2 lg:gap-4 bg-black/40 lg:bg-transparent p-3 lg:p-0 rounded-xl lg:rounded-none border border-white/10 lg:border-none shadow-2xl lg:shadow-none">
                                        <div className="flex-1 lg:flex-none w-full">
                                            <div className="text-[8px] lg:text-[10px] text-slate-500 font-black uppercase tracking-[0.25em] mb-1 lg:mb-2 text-left">CURRENT BID</div>
                                            <div className="flex items-baseline gap-2 lg:gap-3">
                                                <motion.span
                                                    key={currentBid.amount}
                                                    initial={{ scale: 1.5, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    className="text-xl xs:text-2xl lg:text-[min(2.5rem,4vh)] xl:text-[3rem] font-black font-mono tracking-tighter leading-none"
                                                    style={{ color: 'white' }}
                                                >
                                                    ₹{currentBid.amount === 0 ? (currentPlayer.basePrice || 50) : currentBid.amount}
                                                </motion.span>
                                                <span className="text-[10px] lg:text-lg font-black text-slate-500 font-mono">L</span>
                                            </div>
                                            
                                            {currentBid.teamName ? (
                                                <motion.div
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    className="mt-1 lg:mt-2 flex items-center gap-2"
                                                >
                                                    <div className="px-2 lg:px-2.5 py-0.5 lg:py-1 rounded bg-white/5 border border-white/10 text-[8px] lg:text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 max-w-[120px] lg:max-w-none" style={{ color: currentBid.teamColor }}>
                                                        <span className="w-1.5 h-1.5 lg:w-1.5 lg:h-1.5 rounded-full bg-current animate-pulse shrink-0"></span>
                                                        <span className="truncate">{currentBid.teamName}</span>
                                                    </div>
                                                </motion.div>
                                            ) : (
                                                <div className="mt-1 lg:mt-2 text-[9px] lg:text-sm font-black uppercase tracking-[0.2em] text-slate-600 italic leading-none">@ Base Price</div>
                                            )}
                                        </div>

                                        {/* Timer Circle (Shrunk) */}
                                        <div className="relative w-12 lg:w-[min(65px,8vh)] xl:w-[min(75px,9vh)] h-12 lg:h-[min(65px,8vh)] xl:h-[min(75px,9vh)] flex items-center justify-center shrink-0 mt-0 lg:mt-6 lg:ml-12 xl:ml-20">
                                            {!soldEvent ? (
                                                <>
                                                    <svg className="w-full h-full transform -rotate-90 absolute">
                                                        <circle cx="50%" cy="50%" r="40%" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="3 lg:strokeWidth-6" />
                                                        <motion.circle
                                                            cx="50%" cy="50%" r="40%"
                                                            fill="transparent"
                                                            stroke={timerColor}
                                                            strokeWidth="3 lg:strokeWidth-6"
                                                            strokeLinecap="round"
                                                            strokeDasharray="251.2%"
                                                            animate={{ strokeDashoffset: `${timerDashoffset}%`, stroke: timerColor }}
                                                            className="drop-shadow-[0_0_10px_currentColor] lg:drop-shadow-[0_0_15px_currentColor]"
                                                        />
                                                    </svg>
                                                    <motion.div
                                                        key={`timer-${timer}`}
                                                        animate={timer <= 3 ? { scale: [1, 1.3, 1] } : {}}
                                                        className="text-lg lg:text-2xl xl:text-3xl font-black font-mono z-10"
                                                        style={{ color: timerColor }}
                                                    >
                                                        {timer}
                                                    </motion.div>
                                                </>
                                            ) : (
                                                <AnimatePresence>
                                                    <GavelSlam
                                                        type={soldEvent.type}
                                                        playerName={soldEvent.player?.player || soldEvent.player?.name || 'UNKNOWN'}
                                                        teamName={soldEvent.winningBid?.teamName}
                                                        teamColor={soldEvent.winningBid?.teamColor}
                                                        teamLogo={activeTeams.find(t => t.franchiseId === soldEvent.winningBid?.teamId)?.teamLogo || soldEvent.winningBid?.teamLogo}
                                                        winningBid={soldEvent.winningBid}
                                                    />
                                                </AnimatePresence>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Bottom Interaction Bar (Responsive) */}
                {/* Bottom Interaction Bar (Responsive) */}
                <div className="h-[75px] lg:h-[min(128px,14vh)] glass-panel border-t border-white/5 flex items-center justify-between pl-3 pr-4 lg:pl-8 lg:pr-8 z-20 backdrop-blur-3xl shrink-0 relative">
                    <div className="flex items-center gap-2 lg:gap-4 flex-1 min-w-0">
                        {myTeam && (
                            <div className="flex items-center gap-2 lg:gap-5">
                                <div className="w-0.5 lg:w-2 h-8 lg:h-16 rounded-full" style={{ backgroundColor: myTeam.teamThemeColor }}></div>
                                {myTeam.teamLogo && (
                                    <div className="w-8 lg:w-16 h-8 lg:h-16 rounded-lg lg:rounded-2xl bg-white/5 flex items-center justify-center p-1 lg:p-2 border border-white/10 shadow-lg shrink-0">
                                        <img src={myTeam.teamLogo} alt={myTeam.teamName} className="w-full h-full object-contain drop-shadow-md" />
                                    </div>
                                )}
                                <div className="flex flex-col justify-center translate-y-0.5 max-w-[120px] lg:max-w-none">
                                    <div className="text-[5px] lg:text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mb-0.5 lg:mb-1">Signed As</div>
                                    <div className="text-[8px] lg:text-lg font-black tracking-tight uppercase leading-none truncate" style={{ color: myTeam.teamThemeColor }}>{myTeam.teamName}</div>
                                    <div className="text-[6px] lg:text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mt-0.5 lg:mt-1 truncate">₹{myTeam.currentPurse}L</div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3 lg:gap-8 mr-16 lg:mr-32 shrink-0">
                        <div className="text-right flex flex-col items-end">
                            <div className="text-[6px] lg:text-[10px] text-slate-500 font-black uppercase tracking-widest mb-0.5 lg:mb-1">Next Bid</div>
                            <div className="text-lg lg:text-3xl font-black font-mono text-white tracking-tighter leading-none">₹{targetAmount}L</div>
                        </div>
                    </div>

                    {/* Responsive Bid Paddle - Absolutely Positioned */}
                    <button
                        onClick={handleBid}
                        disabled={!myTeam || timer <= 0 || soldEvent || targetAmount > (myTeam?.currentPurse || 0) || currentBid.teamId === myTeam?.franchiseId || myTeam?.playersAcquired?.length >= 25 || (currentPlayer?.isOverseas && (myTeam?.overseasCount || 0) >= 8)}
                        className={`
                            absolute right-2 lg:right-[4rem] bottom-[5px] lg:bottom-[20px] z-[60]
                            flex items-center justify-center w-14 lg:w-24 h-20 lg:h-32 outline-none
                            ${(!myTeam || timer <= 0 || soldEvent || targetAmount > (myTeam?.currentPurse || 0) || currentBid.teamId === myTeam?.franchiseId || isPaused || myTeam?.playersAcquired?.length >= 25 || (currentPlayer?.isOverseas && (myTeam?.overseasCount || 0) >= 8))
                                ? 'opacity-30 grayscale cursor-not-allowed'
                                : 'cursor-pointer'}
                        `}
                    >
                            {/* Wooden Handle */}
                            <div
                                className="absolute bottom-0 w-2 lg:w-6 h-8 lg:h-20 rounded-b-sm lg:rounded-b-md shadow-[inset_0_0_10px_rgba(0,0,0,0.8)] z-0"
                                style={{ background: 'linear-gradient(to right, #704214, #a0522d, #704214)' }}
                            ></div>

                            {/* Silver Collar */}
                            <div className="absolute bottom-[1.8rem] lg:bottom-[4.5rem] w-3 lg:w-8 h-1 lg:h-1.5 bg-gradient-to-r from-gray-400 via-gray-100 to-gray-500 rounded shadow-md z-10"></div>

                            {/* Diamond Paddle Head */}
                            <div
                                className="absolute bottom-[2rem] lg:bottom-[4.8rem] w-10 lg:w-24 h-10 lg:h-24 rotate-45 border-[1px] lg:border-[4px] border-gray-300 shadow-[0_5px_15px_rgba(0,0,0,0.5)] z-20 flex items-center justify-center rounded-sm overflow-hidden"
                                style={{ backgroundColor: myTeam?.teamThemeColor || '#004BA0' }}
                            >
                                <div className="-rotate-45 flex items-center justify-center absolute w-[141%] h-[141%]">
                                    <div className="w-6 lg:w-16 h-6 lg:h-16 bg-white rounded-full flex items-center justify-center shadow-md border border-black/10 shrink-0">
                                        {myTeam?.playersAcquired?.length >= 25 ? (
                                            <span className="text-[5px] lg:text-[10px] font-black text-red-600 leading-none uppercase">Full</span>
                                        ) : (currentPlayer?.isOverseas && (myTeam?.overseasCount || 0) >= 8) ? (
                                            <span className="text-[5px] lg:text-[10px] font-black text-red-600 leading-none uppercase text-center">OS<br/>Full</span>
                                        ) : myTeam?.teamLogo ? (
                                            <img src={myTeam.teamLogo} alt="Logo" className="w-[85%] h-[85%] object-contain" />
                                        ) : (
                                            <span className="text-[8px] lg:text-xl font-black text-slate-800 uppercase">BID</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </button>
                </div>

                {/* Fullscreen Overlay Removed, Stamp injected in Timer container */}
            </div>

            {/* Right Sidebar: Activity & Chat (Responsive) */}
            <AnimatePresence>
                {(activeTab === 'chat' || window.innerWidth >= 1280) && (
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        className={`
                            fixed inset-0 lg:relative xl:flex xl:w-80 glass-panel border-l border-white/5 flex-col z-[60] bg-darkBg
                            ${activeTab === 'chat' ? 'flex' : 'hidden xl:flex'}
                        `}
                    >
                        <div className="px-6 pt-8 mb-4 flex items-center justify-between">
                            <div className="hidden xl:block">
                                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">Auction History</h2>
                                <div className="h-0.5 w-10 bg-white/10"></div>
                            </div>
                            <button onClick={() => setActiveTab('podium')} className="xl:hidden text-slate-500 text-xs font-black uppercase tracking-widest pl-4">Close Chat</button>
                        </div>
                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="hidden xl:flex flex-col flex-1 min-h-0">
                                <BidHistory bidHistory={bidHistory} />
                                <div className="h-px bg-white/10 shrink-0"></div>
                            </div>
                            <ChatSection
                                chatMessages={chatMessages}
                                myTeam={myTeam}
                                chatEndRef={chatEndRef}
                                chatInput={chatInput}
                                setChatInput={setChatInput}
                                handleSendMessage={handleSendMessage}
                            />
                        </div>
                        {/* Spacer for mobile nav bar if sidebar is over it */}
                        <div className="h-20 lg:hidden shrink-0"></div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mobile Navigation Bar */}
            <div className="lg:hidden h-14 glass-panel border-t border-white/10 flex items-center justify-around px-4 z-[100] pb-safe shrink-0">
                <button
                    onClick={() => setActiveTab('teams')}
                    className={`flex flex-col items-center gap-0.5 transition-all ${activeTab === 'teams' ? 'text-blue-400 scale-105' : 'text-slate-500'}`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    <span className="text-[7px] font-black uppercase tracking-widest">Teams</span>
                </button>
                <button
                    onClick={() => setActiveTab('podium')}
                    className={`flex flex-col items-center gap-0.5 transition-all ${activeTab === 'podium' ? 'text-blue-400 scale-105' : 'text-slate-500'}`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-3" /></svg>
                    <span className="text-[7px] font-black uppercase tracking-widest">Podium</span>
                </button>
                <button
                    onClick={() => setActiveTab('chat')}
                    className={`flex flex-col items-center gap-0.5 transition-all ${activeTab === 'chat' ? 'text-blue-400 scale-105' : 'text-slate-500'}`}
                >
                    <div className="relative">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                        {chatMessages.length > 0 && <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></div>}
                    </div>
                    <span className="text-[7px] font-black uppercase tracking-widest">Chat</span>
                </button>
            </div>



            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes ticker {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-ticker {
                    display: inline-flex;
                    animation: ticker 40s linear infinite;
                    will-change: transform;
                }
                .animate-ticker:hover {
                    animation-play-state: paused;
                }
            `}} />
        </div>
    );
};

export default AuctionPodium;

