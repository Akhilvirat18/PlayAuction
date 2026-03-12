import React, { useEffect, useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toPng } from 'html-to-image';
import download from 'downloadjs';
import { Share2, Download, X, Wallet, Users, BarChart3 } from 'lucide-react';

const ResultsReveal = () => {
    const { roomCode } = useParams();
    const navigate = useNavigate();
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [error, setError] = useState(null);
    const [allPlayersMap, setAllPlayersMap] = useState({});
    const [showShareModal, setShowShareModal] = useState(false);

    useEffect(() => {
        // Fetch players to create a fallback name map
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5050';
        fetch(`${apiUrl}/api/players`)
            .then(res => res.json())
            .then(data => {
                const map = {};
                data.forEach(p => {
                    map[p._id] = p; // Store full player object
                    if (p.playerId) map[p.playerId] = p;
                });
                setAllPlayersMap(map);
            })
            .catch(err => console.error("Failed to fetch players for map:", err));
    }, []);

    useEffect(() => {
        const fetchResults = async () => {
            try {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5050';
                const response = await fetch(`${apiUrl}/api/room/${roomCode}/results`);
                const data = await response.json();
                if (response.ok) {
                    const sorted = data.teams.sort((a, b) => a.rank - b.rank);
                    setResults(sorted);
                    setSelectedTeam(sorted[0]);
                    setLoading(false);
                } else {
                    setError(data.error);
                    setLoading(false);
                }
            } catch (err) {
                console.error('Error fetching results:', err);
                setError("Failed to reach server");
                setLoading(false);
            }
        };

        fetchResults();
    }, [roomCode]);

    if (loading) return (
        <div className="min-h-screen bg-darkBg flex flex-col items-center justify-center text-white">
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-white/10 border-t-blue-500 rounded-full mb-8"
            />
            <h2 className="text-xl font-black uppercase tracking-[0.3em] animate-pulse">Gemini AI Evaluating Squads...</h2>
            <p className="text-slate-500 text-sm mt-2 font-bold uppercase tracking-widest">Analyzing Tactical Balance & Firepower</p>
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-darkBg flex flex-col items-center justify-center text-white">
            <h1 className="text-4xl font-black text-red-500 mb-4 uppercase tracking-tighter">Evaluation Error</h1>
            <p className="text-slate-400 mb-8">{error}</p>
            <button onClick={() => navigate('/')} className="btn-premium">Return Home</button>
        </div>
    );

    return (
        <div className="min-h-screen bg-darkBg text-white p-4 lg:p-8 relative overflow-hidden font-sans">

            {/* Background elements */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/10 blur-[150px] rounded-full"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/10 blur-[150px] rounded-full"></div>
            </div>

            <div className="relative z-10 max-w-7xl mx-auto">
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 lg:mb-16 gap-6">
                    <div>
                        <h1 className="text-[8px] lg:text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-2">Auction Concluded / Final Review</h1>
                        <h2 className="text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-black italic tracking-tighter uppercase leading-none">
                            The <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Verdict</span>
                        </h2>
                    </div>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-3 glass-panel rounded-xl border-white/10 hover:bg-white/10 transition-colors text-[10px] font-black uppercase tracking-widest"
                    >
                        Back to Lobby
                    </button>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left: Team List */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Final Rankings</h3>
                        {results.map((team, index) => (
                            <motion.div
                                key={team.teamId || team.teamName || index}
                                initial={{ x: -50, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: index * 0.1 }}
                                onClick={() => setSelectedTeam(team)}
                                className={`
                                    glass-card p-6 rounded-3xl border-white/5 cursor-pointer transition-all relative overflow-hidden group
                                    ${selectedTeam?.teamId === team.teamId ? 'border-white/20 bg-white/10 scale-105' : 'hover:bg-white/5'}
                                `}
                            >
                                <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: team.teamThemeColor }}></div>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-1" style={{ color: team.teamThemeColor }}>#{team.rank} {team.rank === 1 ? 'Winner' : 'Ranked'}</div>
                                        <div className="text-xl font-black uppercase tracking-tight">{team.teamName}</div>
                                        <div className="text-[10px] text-slate-500 font-bold uppercase">{team.ownerName}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-3xl font-black font-mono" style={{ color: team.teamThemeColor }}>{team.evaluation?.overallScore}</div>
                                        <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Global Score</div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Right: Squad Card Detail */}
                    <div className="lg:col-span-2">
                        <AnimatePresence mode="wait">
                            {selectedTeam ? (
                                <motion.div
                                    key={selectedTeam.teamId}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="glass-card rounded-[32px] lg:rounded-[40px] p-6 lg:p-10 border-white/10 relative overflow-hidden h-full flex flex-col"
                                >
                                    {/* Team Header */}
                                    <div className="flex flex-col sm:flex-row justify-between items-start mb-8 lg:mb-12 gap-6">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 lg:gap-4 mb-4">
                                                <div className="w-2 lg:w-4 h-6 lg:h-12 rounded-full" style={{ backgroundColor: selectedTeam.teamThemeColor }}></div>
                                                <h2 className="text-2xl lg:text-4xl xl:text-5xl font-black uppercase tracking-tighter italic leading-tight">{selectedTeam.teamName}</h2>
                                            </div>
                                            <p className="text-slate-300 font-bold max-w-lg leading-relaxed text-sm">
                                                {selectedTeam.evaluation?.tacticalVerdict || selectedTeam.evaluation?.summary}
                                            </p>
                                            <p className="text-blue-400/60 font-black text-[10px] uppercase tracking-widest mt-4">
                                                {selectedTeam.evaluation?.historicalContext}
                                            </p>

                                            {selectedTeam.tieBreakerReason && (
                                                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                                                    <div className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Tie-Breaker Logic</div>
                                                    <p className="text-[11px] font-bold text-blue-200 italic">"{selectedTeam.tieBreakerReason}"</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="glass-panel p-4 lg:p-6 rounded-[24px] lg:rounded-[30px] border-white/5 text-center min-w-[120px]">
                                                <div className="text-3xl lg:text-5xl font-black tracking-tighter" style={{ color: selectedTeam.teamThemeColor }}>{selectedTeam.evaluation?.overallScore}</div>
                                                <div className="text-[8px] lg:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1 lg:mt-2">Overall Rating</div>
                                            </div>
                                            <button
                                                onClick={() => setShowShareModal(true)}
                                                className="btn-premium w-full !py-2 !text-[10px] flex items-center justify-center gap-2"
                                            >
                                                <Share2 size={12} /> View & Share Squad Card
                                            </button>
                                        </div>
                                    </div>

                                    {/* Breakdown */}
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6 lg:mb-8">
                                        <div className="glass-panel rounded-3xl p-4 border-white/5 text-center">
                                            <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Batting</div>
                                            <div className="text-2xl font-black">{selectedTeam.evaluation?.battingScore}</div>
                                        </div>
                                        <div className="glass-panel rounded-3xl p-4 border-white/5 text-center">
                                            <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Bowling</div>
                                            <div className="text-2xl font-black">{selectedTeam.evaluation?.bowlingScore}</div>
                                        </div>
                                        <div className="glass-panel rounded-3xl p-4 border-white/5 text-center">
                                            <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Balance</div>
                                            <div className="text-2xl font-black">{selectedTeam.evaluation?.balanceScore}</div>
                                        </div>
                                        <div className="glass-panel rounded-3xl p-4 border-white/5 text-center">
                                            <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Impact</div>
                                            <div className="text-2xl font-black">{selectedTeam.evaluation?.impactScore || selectedTeam.evaluation?.formScore}</div>
                                        </div>
                                    </div>

                                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl mb-8">
                                        <div className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-1">Tactical Weakness</div>
                                        <p className="text-red-300 text-xs font-bold leading-relaxed">{selectedTeam.evaluation?.weakness}</p>
                                    </div>

                                    {/* Squad List */}
                                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Team Profile</h3>
                                            <div className="flex gap-4">
                                                <div className="text-[10px] font-black text-yellow-500 uppercase tracking-widest bg-yellow-500/10 px-2 py-1 rounded">⭐ Star: {selectedTeam.evaluation?.starPlayer}</div>
                                                <div className="text-[10px] font-black text-green-400 uppercase tracking-widest bg-green-400/10 px-2 py-1 rounded">💎 Gem: {selectedTeam.evaluation?.hiddenGem || selectedTeam.evaluation?.bestValuePick}</div>
                                            </div>
                                        </div>

                                        {selectedTeam.evaluation?.playing11 && (
                                            <div className="mb-8 p-6 bg-white/5 border border-white/10 rounded-3xl">
                                                <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-4 text-center">AI Recommended Playing 11</h4>
                                                <div className="flex flex-wrap justify-center gap-2">
                                                    {selectedTeam.evaluation.playing11.map((name, idx) => (
                                                        <span key={`${name}-${idx}`} className="bg-blue-600/20 text-blue-300 px-3 py-1 rounded-full text-[10px] font-black border border-blue-500/20 uppercase tracking-widest">
                                                            {name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Full Squad</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {selectedTeam.playersAcquired.map((entry, idx) => (
                                                <div key={entry.player?._id || entry.player || idx} className="glass-panel p-3 rounded-2xl border-white/5 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center font-black text-[10px] text-slate-500">
                                                            {idx + 1}
                                                        </div>
                                                        <div className="text-sm font-bold text-white truncate max-w-[150px]">
                                                            {entry.name || (entry.player && allPlayersMap[entry.player]?.player) || (entry.player && allPlayersMap[entry.player]?.name) || "Unknown Player"}
                                                        </div>
                                                    </div>
                                                    <div className="text-xs font-mono font-black text-slate-400">₹{entry.boughtFor}L</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                </motion.div>
                            ) : null}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Share Modal */}
            <AnimatePresence>
                {showShareModal && selectedTeam && (
                    <TeamShareModal 
                        team={selectedTeam} 
                        playersMap={allPlayersMap} 
                        onClose={() => setShowShareModal(false)} 
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

const TeamShareModal = ({ team, playersMap, onClose }) => {
    const cardRef = React.useRef(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const handleDownload = async () => {
        if (!cardRef.current) return;
        setIsGenerating(true);
        
        // Save current styles
        const originalWidth = cardRef.current.style.width;
        const originalHeight = cardRef.current.style.height;
        
        // Force a professional capture viewport (1080p width)
        // This ensures the image is always high-res and perfectly laid out
        cardRef.current.style.width = '1080px';
        cardRef.current.style.height = 'auto';
        
        try {
            // Give browser a frame to apply styles
            await new Promise(r => setTimeout(r, 100));
            
            const dataUrl = await toPng(cardRef.current, { 
                cacheBust: true, 
                quality: 1, 
                pixelRatio: 2, // 2x is enough on a 1080px base
                backgroundColor: team.teamThemeColor || '#ED1B24'
            });
            
            download(dataUrl, `${team.teamName.replace(/\s+/g, '_')}_Squad_2025.png`);
        } catch (err) {
            console.error('Failed to generate card image:', err);
            alert('Export failed. Please try a screenshot for now!');
        } finally {
            // Restore styles
            cardRef.current.style.width = originalWidth;
            cardRef.current.style.height = originalHeight;
            setIsGenerating(false);
        }
    };

    const handleShare = async () => {
        if (!cardRef.current) return;
        try {
            const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 1.5 });
            const blob = await (await fetch(dataUrl)).blob();
            const file = new File([blob], 'squad.png', { type: 'image/png' });
            
            if (navigator.share && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: `${team.teamName} Squad`,
                    text: `My professional ${team.teamName} squad is ready for IPL 2025!`
                });
            } else {
                const shareText = `Check out my ${team.teamName} squad! Final evaluated score: ${team.evaluation?.overallScore}/100.`;
                await navigator.clipboard.writeText(shareText);
                alert('Stats copied! Share the HQ image for the best view.');
            }
        } catch (err) {
            console.error('Share failed:', err);
        }
    };

    const starPlayerName = team.evaluation?.starPlayer;
    const starPlayerObj = Object.values(playersMap).find(p => (p.player || p.name) === starPlayerName);
    const starPlayerImg = starPlayerObj?.image_path || starPlayerObj?.imagepath || starPlayerObj?.photoUrl;

    const players = team.playersAcquired;
    const colSize = Math.ceil(players.length / 3);
    const columns = [
        players.slice(0, colSize),
        players.slice(colSize, colSize * 2),
        players.slice(colSize * 2)
    ];

    return (
        <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-start justify-center p-3 sm:p-4 bg-black/98 backdrop-blur-3xl overflow-y-auto pt-6 pb-20 sm:pt-20"
        >
            <div className="max-w-5xl w-full">
                {/* Control Bar */}
                <div className="flex justify-between items-center mb-6 bg-white/5 p-4 sm:p-6 rounded-[24px] overflow-hidden backdrop-blur-xl border border-white/10 sticky top-0 z-[210] shadow-2xl">
                    <div className="hidden sm:block">
                        <h3 className="text-xl font-black uppercase tracking-tighter text-white">Professional HQ Card</h3>
                        <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest">Ultra-HD Rendering Mode</p>
                    </div>
                    <div className="flex gap-2 sm:gap-4 w-full sm:w-auto">
                        <button 
                            onClick={handleDownload}
                            disabled={isGenerating}
                            className="flex-1 sm:flex-none bg-white text-black hover:bg-slate-200 disabled:opacity-50 px-6 sm:px-8 py-3 rounded-full text-[10px] sm:text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl"
                        >
                            {isGenerating ? 'Rendering...' : <><Download size={14} /> Save HQ</>}
                        </button>
                        <button onClick={onClose} className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors flex items-center justify-center">
                            <X size={24} className="text-white" />
                        </button>
                    </div>
                </div>

                {/* THE CARD DESIGN - MOBILE RESPONSIVE PREVIEW */}
                <div 
                    ref={cardRef}
                    className="relative w-full shadow-[0_50px_100px_-20px_rgba(0,0,0,0.6)] bg-[#ED1B24] rounded-[24px] sm:rounded-3xl overflow-hidden"
                    style={{ 
                        backgroundColor: team.teamThemeColor || '#ED1B24',
                        height: 'auto',
                        minHeight: '800px'
                    }}
                >
                    {/* Pattern */}
                    <div className="absolute top-10 left-10 grid grid-cols-2 gap-3 opacity-10">
                        {[...Array(6)].map((_, i) => <div key={i} className="w-2 h-2 rounded-full bg-white"></div>)}
                    </div>

                    <div className="relative h-full flex flex-col p-6 sm:p-16">
                        {/* Top Branding - Flex Column on Mobile */}
                        <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start mb-12 sm:mb-24 gap-8 text-center sm:text-left">
                            {/* Star Player Feature - Adjusted Size for Mobile */}
                            <div className="relative">
                                <div className="w-32 h-32 sm:w-64 sm:h-64 rounded-full border-[6px] sm:border-[10px] border-white overflow-hidden shadow-2xl bg-black/10 ring-[8px] sm:ring-[14px] ring-white/10">
                                    {starPlayerImg ? (
                                        <img src={starPlayerImg} alt="Star" className="w-full h-full object-cover object-top scale-110" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white/5 font-black text-2xl italic uppercase">STAR</div>
                                    )}
                                </div>
                                {starPlayerName && (
                                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white text-black px-5 py-2 rounded-full text-[8px] sm:text-[12px] font-black uppercase tracking-[0.2em] whitespace-nowrap shadow-2xl">
                                        {starPlayerName}
                                    </div>
                                )}
                            </div>

                            {/* Team Identity - Adjusted Sizes */}
                            <div className="flex flex-col items-center sm:items-end">
                                {team.teamLogo && (
                                    <div className="h-20 sm:h-40 mb-6 drop-shadow-2xl">
                                        <img src={team.teamLogo} alt="Logo" className="h-full object-contain" />
                                    </div>
                                )}
                                <h2 className="text-2xl sm:text-6xl font-black text-white uppercase italic leading-[0.85] tracking-tighter">
                                    {team.teamName.split(' ').map((word, i) => (
                                        <span key={i} className="block drop-shadow-xl">{word}</span>
                                    ))}
                                    <span className="block text-4xl sm:text-[110px] mt-2 opacity-100 drop-shadow-2xl tracking-tight">SQUAD</span>
                                </h2>
                            </div>
                        </div>

                        {/* Player Grid - 3 Columns with Responsive Spacing */}
                        <div className="flex-1 grid grid-cols-3 gap-x-2 sm:gap-x-10 gap-y-2.5 mb-20">
                            {columns.map((column, colIdx) => (
                                <div key={colIdx} className="space-y-2">
                                    {column.map((entry, idx) => (
                                        <div 
                                            key={idx} 
                                            className="bg-black/20 backdrop-blur-md rounded-full py-2 px-3 sm:px-5 flex items-center justify-between border border-white/10 shadow-lg"
                                        >
                                            <span className="text-[7px] sm:text-[14px] font-black text-white uppercase italic tracking-tighter whitespace-nowrap overflow-hidden pr-2 drop-shadow-md">
                                                {entry.name}
                                            </span>
                                            {entry.isOverseas && (
                                                <span className="text-white/80 flex-shrink-0">
                                                    <svg className="w-2.5 h-2.5 sm:w-4 sm:h-4 fill-current" viewBox="0 0 24 24">
                                                        <path d="M21,16.5C21,16.88 20.79,17.21 20.47,17.38L12.57,21.82C12.41,21.94 12.21,22 12,22C11.79,22 11.59,21.94 11.43,21.82L3.53,17.38C3.21,17.21 3,16.88 3,16.5V7.5C3,7.12 3.21,6.79 3.53,6.62L11.43,2.18C11.59,2.06 11.79,2 12,2C12.21,2 12.41,2.06 12.57,2.18L20.47,6.62C20.79,6.79 21,7.12 21,7.5V16.5Z" opacity="0.4" />
                                                        <path d="M22,16V5l-10,4.5l-10-4.5v11l10,4.5l10-4.5z" />
                                                    </svg>
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>

                        {/* Footer Patterns */}
                        <div className="mt-auto flex justify-between items-end border-t border-white/20 pt-10 pb-2">
                            <div className="space-y-3 opacity-20">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-white"></div>
                                ))}
                            </div>
                            <div className="flex flex-col items-end">
                                <div className="text-[10px] sm:text-[16px] font-black uppercase tracking-[0.5em] text-white/50 italic mb-1">
                                    PROFESSIONAL DRAFT 2025
                                </div>
                                <div className="text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.3em] text-white/20">
                                    GENERATED BY IPL AUCTION VERDICT
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 text-center sm:hidden">
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                        Tip: Save HQ ensures perfect resolution on mobile
                    </p>
                </div>
            </div>
        </motion.div>
    );
};

export default ResultsReveal;
