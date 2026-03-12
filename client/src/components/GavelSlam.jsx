import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { playCustomSlam } from '../utils/soundEngine';

const GavelSlam = ({ type, teamName, teamColor, teamLogo, playerName, winningBid }) => {

    useEffect(() => {
        playCustomSlam(type, teamName);

        if (type === 'SOLD') {
            const timer = setTimeout(() => {
                const end = Date.now() + 2000;
                const colors = [teamColor || '#ffffff', '#ffffff', '#ffcc33'];

                const myCanvas = document.getElementById('podium-confetti');
                const runConfetti = myCanvas ? confetti.create(myCanvas, { resize: true }) : confetti;

                (function frame() {
                    runConfetti({
                        particleCount: 3,
                        angle: 60,
                        spread: 55,
                        origin: { x: 0 },
                        colors: colors
                    });
                    runConfetti({
                        particleCount: 3,
                        angle: 120,
                        spread: 55,
                        origin: { x: 1 },
                        colors: colors
                    });

                    if (Date.now() < end) {
                        requestAnimationFrame(frame);
                    }
                }());
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [type, teamColor, teamName]);

    // Generate the starburst badge outer path
    const getStarburstPath = (cx, cy, outerRadius, innerRadius, points) => {
        let path = '';
        const angleStep = Math.PI / points;
        for (let i = 0; i < 2 * points; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = i * angleStep;
            const x = cx + radius * Math.cos(angle);
            const y = cy + radius * Math.sin(angle);
            path += (i === 0 ? 'M ' : 'L ') + `${x},${y} `;
        }
        path += 'Z';
        return path;
    };

    if (type === 'SOLD') {
        const cx = 140;
        const cy = 140;
        const starburstPath = getStarburstPath(cx, cy, 130, 115, 32);
        const badgeColor = teamColor || '#FFEB3B';

        return (
            <motion.div
                initial={{ scale: 2, opacity: 0, rotate: -20 }}
                animate={{ scale: window.innerWidth < 1024 ? 0.35 : 0.25, opacity: 1, rotate: -10 }}
                exit={{ scale: 0, opacity: 0, y: -50 }}
                transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
                className="absolute z-[100] drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)] flex items-center justify-center pointer-events-none"
            >
                <svg viewBox="0 0 280 280" className="w-[150px] h-[150px] lg:w-[280px] lg:h-[280px] overflow-visible">
                    <defs>
                        <path id="curveTop" d={`M ${cx - 75},${cy} A 75,75 0 0,1 ${cx + 75},${cy}`} fill="transparent" />
                        <path id="curveBottom" d={`M ${cx - 85},${cy} A 85,85 0 0,0 ${cx + 85},${cy}`} fill="transparent" />
                        <filter id="shadowGlow" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.4" floodColor="#000" />
                        </filter>
                    </defs>

                    {/* Starburst Base */}
                    <path d={starburstPath} fill={badgeColor} stroke="rgba(255,255,255,0.4)" strokeWidth="3" filter="url(#shadowGlow)" />

                    {/* Inner Accent Ring */}
                    <circle cx={cx} cy={cy} r="105" fill={badgeColor} stroke="rgba(0,0,0,0.2)" strokeWidth="3" />

                    {/* Inner Content Area */}
                    <circle cx={cx} cy={cy} r="95" fill={badgeColor} stroke="white" strokeWidth="2" strokeDasharray="6 4" />
                    <circle cx={cx} cy={cy} r="50" fill="white" stroke="rgba(0,0,0,0.1)" strokeWidth="2" />

                    {/* Top Text: Player Name */}
                    <text fontSize={playerName && playerName.length > 12 ? "18" : "22"} fontWeight="900" fill="white" letterSpacing="1" style={{ fontFamily: 'Outfit, Arial, sans-serif', textShadow: '2px 2px 4px rgba(0,0,0,0.9)', stroke: 'rgba(0,0,0,0.5)', strokeWidth: '0.5px' }}>
                        <textPath href="#curveTop" startOffset="50%" textAnchor="middle">
                            {playerName ? playerName.toUpperCase() : "PLAYER"}
                        </textPath>
                    </text>

                    {/* Bottom Text: SOLD TO Team and Amount */}
                    <text fontSize={teamName && teamName.length > 15 ? "11" : "13"} fontWeight="900" fill="white" letterSpacing="0.5" style={{ fontFamily: 'Outfit, Arial, sans-serif', textShadow: '2px 2px 4px rgba(0,0,0,0.9)', stroke: 'rgba(0,0,0,0.5)', strokeWidth: '0.5px' }}>
                        <textPath href="#curveBottom" startOffset="50%" textAnchor="middle">
                            SOLD TO {teamName ? teamName.toUpperCase().substring(0, 20) : "FRANCHISE"} • ₹{winningBid?.amount || '0'}L
                        </textPath>
                    </text>

                    {/* Team Logo or Initial */}
                    {teamLogo ? (
                        <image href={teamLogo} x={cx - 40} y={cy - 40} width="80" height="80" preserveAspectRatio="xMidYMid meet" />
                    ) : (
                        <text x={cx} y={cy + 12} fontSize="36" fontWeight="900" textAnchor="middle" fill="#000">
                            {teamName?.charAt(0)}
                        </text>
                    )}
                </svg>
            </motion.div>
        );
    }

    // UNSOLD Rubber Stamp Style
    return (
        <motion.div
            initial={{ scale: 2, opacity: 0, rotate: 10 }}
            animate={{ scale: window.innerWidth < 1024 ? 0.35 : 0.25, opacity: 1, rotate: -15 }}
            exit={{ scale: 0, opacity: 0, y: -50 }}
            transition={{ type: "spring", stiffness: 200, damping: 10, delay: 0.1 }}
            className="absolute z-[100] px-4 py-2 lg:px-10 lg:py-5 border-[4px] lg:border-[8px] border-red-600 rounded-xl lg:rounded-3xl drop-shadow-[0_15px_15px_rgba(220,38,38,0.4)] bg-black/60 backdrop-blur-sm pointer-events-none overflow-hidden"
            style={{
                boxShadow: 'inset 0 0 15px rgba(220,38,38,0.4), 0 0 15px rgba(220,38,38,0.2)'
            }}
        >
            <div className="absolute inset-0 border-[2px] lg:border-[3px] border-red-600/60 m-1 lg:m-2 rounded-lg lg:rounded-2xl" style={{ borderStyle: 'dotted' }}></div>
            <h1 className="text-3xl lg:text-6xl font-black uppercase tracking-[0.3em] leading-none text-red-600 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] opacity-95"
                style={{
                    fontFamily: '"Courier New", Courier, monospace',
                    transform: 'scaleY(1.3)',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 0 #991b1b, 1px -1px 0 #991b1b, -1px 1px 0 #991b1b, 1px 1px 0 #991b1b'
                }}>
                UNSOLD
            </h1>
        </motion.div>
    );
};

export default GavelSlam;
