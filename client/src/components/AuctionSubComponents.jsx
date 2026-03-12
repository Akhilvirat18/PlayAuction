import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImAirplane } from "react-icons/im";

export const TeamList = memo(({ teams, currentBidTeamId, expandedTeamId, setExpandedTeamId, allPlayersMap }) => (
    <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-3 custom-scrollbar">
        {teams.map((t, i) => (
            <motion.div
                key={i}
                onClick={() => setExpandedTeamId(expandedTeamId === t.franchiseId ? null : t.franchiseId)}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className={`
                    rounded-2xl p-4 flex flex-col relative overflow-hidden transition-all duration-300 cursor-pointer
                    ${currentBidTeamId === t.franchiseId ? 'bg-white/10 border-white/20' : 'bg-slate-900/40 border border-white/5 hover:bg-slate-800/60'}
                `}
            >
                <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: t.teamThemeColor }}></div>

                <div className="flex justify-between items-center z-10 mb-2">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            {t.teamLogo ? (
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center p-1 border border-white/10">
                                    <img src={t.teamLogo} alt={t.teamName} className="w-full h-full object-contain" />
                                </div>
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-white/10">
                                    <span className="text-[10px] font-black text-white">{t.teamName.charAt(0)}</span>
                                </div>
                            )}
                            <div 
                                className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-950 shadow-sm ${t.isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.4)]'}`} 
                                title={t.isOnline ? "Online" : "Offline"}
                            ></div>
                        </div>
                        <span className="font-black text-xs lg:text-[13px] tracking-tight uppercase" style={{ color: t.teamThemeColor }}>{t.teamName}</span>
                    </div>
                    <span className="font-mono font-black text-base lg:text-lg text-white">₹{t.currentPurse}L</span>
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1 z-10 font-bold ml-11">
                    <span className="uppercase tracking-widest">{t.ownerName}</span>
                    <div className="flex items-center gap-2">
                        {t.playersAcquired?.length >= 25 && (
                            <span className="text-red-500 font-black animate-pulse">SQUAD FULL</span>
                        )}
                        <div className="flex items-center bg-white/5 rounded px-2 py-0.5 gap-2 divide-x divide-white/10">
                            <span className="text-white/50">{t.playersAcquired?.length || 0} / 25</span>
                            <span className={`pl-2 flex items-center gap-1 ${t.overseasCount >= 8 ? 'text-blue-400' : 'text-white/30'}`}>
                                <ImAirplane className="-rotate-45" size={8} />
                                {t.overseasCount || 0} / 8
                            </span>
                        </div>
                    </div>
                </div>

                <AnimatePresence>
                    {expandedTeamId === t.franchiseId && t.playersAcquired?.length > 0 && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-4 border-t border-white/10 pt-3 flex flex-col gap-2 z-10 overflow-hidden"
                        >
                            <div className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Acquired Players</div>
                            {t.playersAcquired.map((p, idx) => {
                                let displayName = p.name;
                                if (!displayName || String(displayName).match(/^[0-9a-fA-F]{24}$/)) {
                                    displayName = allPlayersMap[p.player] || allPlayersMap[p._id] || p.player || 'Unknown';
                                }
                                return (
                                    <div key={idx} className="flex justify-between items-center text-[10px] font-bold bg-black/20 p-2 rounded border border-white/5">
                                        <span className="text-white uppercase truncate pr-2 flex items-center gap-1.5">
                                            {displayName}
                                            {p.isOverseas && <ImAirplane className="text-blue-400 -rotate-45" size={10} title="Overseas Player" />}
                                        </span>
                                        <span className="text-blue-400 shrink-0">₹{p.boughtFor}L</span>
                                    </div>
                                );
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        ))}
    </div>
));

export const BidHistory = memo(({ bidHistory }) => (
    <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col-reverse gap-3 custom-scrollbar">
        <div className="flex flex-col-reverse gap-3">
            {bidHistory.map((bid) => (
                <div key={bid.id} className="relative group ml-4 mr-2">
                    <div className="bg-slate-900/60 border border-white/10 p-2 transform skew-x-[-15deg] shadow-[0_5px_15px_rgba(0,0,0,0.3)] relative overflow-hidden flex items-center gap-3">
                        <div className="transform skew-x-[15deg] flex items-center w-full min-w-0">
                            <div className="w-8 h-8 shrink-0 bg-black/40 rounded-full flex items-center justify-center p-1 border border-white/10 mr-3 shadow-inner">
                                {bid.teamLogo ? (
                                    <img src={bid.teamLogo} alt={bid.teamName} className="w-full h-full object-contain drop-shadow-md" />
                                ) : (
                                    <span className="text-[10px] font-black text-white">{bid.teamName.charAt(0)}</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <div className="flex justify-between items-start mb-0.5">
                                    <div className="text-[9px] font-black uppercase tracking-widest truncate max-w-[100px]" style={{ color: bid.teamColor }}>
                                        {bid.teamName}
                                    </div>
                                    <div className="text-[8px] text-slate-500 font-bold bg-black/40 px-1 rounded ml-1 shrink-0">
                                        {bid.time}
                                    </div>
                                </div>
                                <div className="flex justify-between items-end">
                                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[80px]">
                                        {bid.ownerName}
                                    </div>
                                    <div className="text-sm font-black font-mono text-white tracking-tighter">
                                        ₹{bid.amount}L
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: bid.teamColor }}></div>
                    </div>
                </div>
            ))}
        </div>
        {bidHistory.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-700">
                <div className="text-[10px] font-black uppercase tracking-widest">Awaiting Bids</div>
            </div>
        )}
    </div>
));

export const ChatSection = memo(({ chatMessages, myTeam, chatEndRef, chatInput, setChatInput, handleSendMessage }) => {
    const [showPicker, setShowPicker] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState('emojis');

    const stickers = [
        { id: 'sixer', url: 'https://cdn-icons-png.flaticon.com/512/5351/5351834.png', label: 'SIX!' },
        { id: 'wicket', url: 'https://cdn-icons-png.flaticon.com/512/5351/5351786.png', label: 'OUT!' },
        { id: 'boundary', url: 'https://cdn-icons-png.flaticon.com/512/5351/5351829.png', label: 'FOUR!' },
        { id: 'trophy', url: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png', label: 'WIN' },
    ];

    const emojis = ['🔥', '👏', '😲', '🏏', '💎', '🚀', '🔨', '😂', '💯', '🙌'];

    const insertEmoji = (emoji) => {
        setChatInput(prev => prev + emoji);
        // Keep picker open for emojis
    };

    const sendSticker = (stickerUrl) => {
        // We'll wrap stickers in a special format or just send the URL
        handleSendMessage({
            preventDefault: () => { },
            customMessage: `[STICKER:${stickerUrl}]`
        });
        setShowPicker(false);
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-slate-900/50">
            <div className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-black/20">
                <div>
                    <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Room Chat</h2>
                </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {chatMessages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-600 text-[10px] font-bold uppercase tracking-widest text-center px-4">
                        Send a message to the room
                    </div>
                ) : (
                    chatMessages.map((msg) => {
                        const isMe = msg.senderName === (myTeam?.ownerName || 'Host') && msg.senderTeam === (myTeam?.teamName || 'System');
                        const isSticker = msg.message.startsWith('[STICKER:');
                        const stickerUrl = isSticker ? msg.message.replace('[STICKER:', '').replace(']', '') : null;

                        return (
                            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                <div className="flex items-baseline gap-2 mb-1 px-1">
                                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: isMe ? '#ffffff' : msg.senderColor }}>
                                        {msg.senderName}
                                    </span>
                                    <span className="text-[8px] text-slate-500 font-bold">{msg.timestamp}</span>
                                </div>

                                {isSticker ? (
                                    <motion.div
                                        initial={{ scale: 0.5, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="w-24 h-24 p-2 bg-white/5 rounded-2xl border border-white/10"
                                    >
                                        <img src={stickerUrl} alt="Sticker" className="w-full h-full object-contain" />
                                    </motion.div>
                                ) : (
                                    <div
                                        className={`max-w-[85%] px-3 py-2 rounded-2xl text-[11px] font-medium leading-relaxed
                                            ${isMe ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white/10 text-slate-200 rounded-tl-sm border border-white/5'}
                                        `}
                                    >
                                        {msg.message}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
                <div ref={chatEndRef} />
            </div>

            {/* Picker Panel */}
            <AnimatePresence>
                {showPicker && (
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 20, opacity: 0 }}
                        className="mx-4 mb-2 bg-slate-800 border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50"
                    >
                        <div className="flex border-b border-white/5">
                            <button
                                onClick={() => setActiveTab('emojis')}
                                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest ${activeTab === 'emojis' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                            >
                                Emojis
                            </button>
                            <button
                                onClick={() => setActiveTab('stickers')}
                                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest ${activeTab === 'stickers' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                            >
                                Stickers
                            </button>
                        </div>
                        <div className="p-4 max-h-48 overflow-y-auto custom-scrollbar">
                            {activeTab === 'emojis' ? (
                                <div className="grid grid-cols-5 gap-2">
                                    {emojis.map(e => (
                                        <button key={e} onClick={() => insertEmoji(e)} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-xl text-xl transition-all active:scale-90">
                                            {e}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-3">
                                    {stickers.map(s => (
                                        <button key={s.id} onClick={() => sendSticker(s.url)} className="flex flex-col items-center gap-1 p-2 hover:bg-white/10 rounded-xl transition-all group">
                                            <img src={s.url} alt={s.label} className="w-12 h-12 object-contain group-hover:scale-110 transition-transform" />
                                            <span className="text-[8px] font-black text-slate-500 uppercase">{s.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Chat Input Area */}
            <div className="p-4 border-t border-white/5 bg-slate-900/80 backdrop-blur-xl relative">
                <form
                    onSubmit={(e) => {
                        handleSendMessage(e);
                        setShowPicker(false);
                    }}
                    className="flex items-center gap-2"
                >
                    <button
                        type="button"
                        onClick={() => setShowPicker(!showPicker)}
                        className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-2xl border transition-all ${showPicker ? 'bg-blue-600 border-blue-400 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 9h.01M15 9h.01" />
                        </svg>
                    </button>

                    <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Message room..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all outline-none"
                    />

                    <button
                        type="submit"
                        disabled={!chatInput.trim()}
                        className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-30 disabled:grayscale flex items-center justify-center transition-all shadow-lg shadow-blue-900/20 shrink-0"
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white ml-0.5">
                            <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
                        </svg>
                    </button>
                </form>
            </div>
        </div>
    );
});
