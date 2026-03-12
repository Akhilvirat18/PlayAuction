const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const extractJSON = (text) => {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0].replace(/```json/g, '').replace(/```/g, '').trim());
        }
        return JSON.parse(text);
    } catch (e) {
        console.error("Failed to parse AI JSON:", e, "Original text:", text);
        throw e;
    }
};

const evaluateTeam = async (team) => {
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const prompt = `
You are a cynical, world-class T20 Franchise Consultant known for your brutal honesty and "High-Performance or Bust" attitude. You despise mediocrity and value tactical perfection.

Team Name: ${team.teamName}
Total Budget: ₹12000L
Budget Remaining: ₹${team.currentPurse || team.budgetRemaining}L

Drafted Squad (Total Players: ${team.playersAcquired.length}):
${team.playersAcquired.map(p => {
        const s = p.stats || {};
        const role = p.role || 'Unknown';
        return `- ${p.name || 'Unknown'} (${role}, ${p.nationality || 'Local'}) | Matches: ${s.matches || 0}, Runs: ${s.runs || 0}, SR: ${s.strikeRate || 0}, Wickets: ${s.wickets || 0}, Econ: ${s.economy || 0} | Price: ₹${p.boughtFor || 0}L`;
    }).join('\n')}

DIRECTIONS FOR EVALUATION:
1. **Be Brutal**: If a selection is a waste of money (old, poor stats, or overpriced), call it out. If the squad is balanced but lacks a "X-factor" superstar, mark them down.
2. **Tactical Depth**: Check for "finishers", "death bowlers", and "Powerplay specialists". Don't just look at names, look at the stats.
3. **Budget Usage**: Leaving too much money on the table is a fireable offense. Spending it all on one or two players is equally stupid.
4. **Grant Granularity**: Use the overallScore to distinguish quality.

RESPOND ONLY WITH A VALID JSON OBJECT matching this EXACT structure:
{
  "battingScore": <1-10>,
  "bowlingScore": <1-10>,
  "balanceScore": <1-10>,
  "impactScore": <1-10>,
  "overallScore": <1-100 (Be extremely precise: use decimals if needed, e.g., 88.4)>,
  "starPlayer": "<Name of biggest match-winner>",
  "hiddenGem": "<Name of a high-value steal>",
  "playing11": ["Name1", "Name2", ... (Exactly 11 names of their best squad)],
  "tacticalVerdict": "3-4 sentences of 'expert' analysis. Be sharp, critical, and specific about their squad construction.",
  "weakness": "1-2 sentences of brutal honesty about why this team will fail or struggle.",
  "historicalContext": "A snarky comparison to a famous IPL failure or success."
}
No other text. Be an expert, be rude, be accurate.
`;

    try {
        console.log(`--- AI Evaluation Starting for ${team.teamName} ---`);
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        console.log(`--- AI Response received for ${team.teamName} ---`);
        return extractJSON(text);
    } catch (error) {
        console.error('Error in AI evaluation:', error);
        return {
            battingScore: 0, bowlingScore: 0, balanceScore: 0, impactScore: 0, overallScore: 0,
            starPlayer: "N/A", hiddenGem: "N/A", playing11: [],
            tacticalVerdict: "Evaluation failed due to technical error or incomplete roster analysis.",
            weakness: "No data available.",
            historicalContext: "N/A"
        };
    }
};

const calculateHeuristicScore = (team) => {
    const players = team.playersAcquired;
    const roles = {
        'batsman': 0,
        'Bowler': 0,
        'All-Rounder': 0,
        'Wicketkeeper': 0
    };

    players.forEach(p => {
        const role = (p.role || 'Batsman').toLowerCase();
        if (role.includes('keep')) roles['Wicketkeeper']++;
        else if (role.includes('all')) roles['All-Rounder']++;
        else if (role.includes('bowl')) roles['Bowler']++;
        else roles['batsman']++; // Default
    });

    // Simple IPL squad balance heuristic
    let balancePoints = 0;
    if (roles['batsman'] >= 5) balancePoints += 20;
    if (roles['Bowler'] >= 4) balancePoints += 20;
    if (roles['All-Rounder'] >= 2) balancePoints += 20;
    if (roles['Wicketkeeper'] >= 1) balancePoints += 20;
    if (players.length >= 11) balancePoints += 20;

    return balancePoints;
};

const selectTop15 = async (teamName, players) => {
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const prompt = `
You are an elite T20 Franchise Cricket Head Coach. Your team "${teamName}" has drafted ${players.length} players.
You must select the BEST "Playing 15" for the upcoming IPL season.

Drafted Players with Stats:
${players.map((p, i) => `ID: [${p.player?._id || p.player}] | Name: ${p.player?.player || p.name} | Role: ${p.player?.role} | Matches: ${p.player?.stats?.matches || 0}, Runs: ${p.player?.stats?.runs || 0}, SR: ${p.player?.stats?.strikeRate || 0}, Wickets: ${p.player?.stats?.wickets || 0}, Econ: ${p.player?.stats?.economy || 0}`).join('\n')}

Select exactly 15 players that provide the best balance of:
1. Explosive openers and middle-order anchors.
2. At least one world-class wicket-keeper.
3. Genuine all-rounders.
4. Tactical bowling variety (Pace, Left-arm, Leg-spin, Off-spin).

RESPOND ONLY WITH A VALID JSON ARRAY containing ONLY the 15 IDs (strings) of the players you selected:
["id1", "id2", ..., "id15"]
No other text. Strictly return a JSON array of strings.
`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const selectedIds = extractJSON(text);

        if (Array.isArray(selectedIds) && selectedIds.length > 0) {
            return selectedIds;
        }
        return players.slice(0, 15).map(p => String(p.player?._id || p.player));
    } catch (error) {
        console.error('Error in AI player selection:', error);
        return players.slice(0, 15).map(p => String(p.player?._id || p.player));
    }
};

const evaluateAllTeams = async (teamsData) => {
    // Process all teams in parallel
    const evaluations = await Promise.all(
        teamsData.map(async (team) => {
            // If playing15 is set, only evaluate those players
            // Otherwise use playersAcquired
            const squadToEvaluate = (team.playing15 && team.playing15.length > 0)
                ? team.playersAcquired.filter(p => team.playing15.includes(String(p.id)))
                : team.playersAcquired;

            const hScore = calculateHeuristicScore({ ...team, playersAcquired: squadToEvaluate });
            let evaluation;
            try {
                console.log(`--- EVALUATING SQUAD FOR ${team.teamName} (${squadToEvaluate.length} players) ---`);
                evaluation = await evaluateTeam({ ...team, playersAcquired: squadToEvaluate });
                // Blend with heuristic or ensure overallScore isn't 0 if AI fails
                if (evaluation.overallScore === 0) evaluation.overallScore = hScore;
            } catch (e) {
                evaluation = {
                    battingScore: Math.round(hScore / 10),
                    bowlingScore: Math.round(hScore / 10),
                    balanceScore: Math.round(hScore / 10),
                    impactScore: 7,
                    starPlayer: "N/A",
                    hiddenGem: "N/A",
                    playing11: squadToEvaluate.slice(0, 11).map(p => p.name || "Unknown"),
                    tacticalVerdict: "Heuristic evaluation complete. Squad meets minimum requirements for a competitive season.",
                    weakness: "Manual analysis recommended for deeper tactical insight.",
                    historicalContext: "Standard squad composition."
                };
            }
            return {
                ...team,
                evaluation
            };
        })
    );

    // Final Ranking & Tie-Breaker Phase
    const finalRankings = await MasterRanker(evaluations);
    return finalRankings;
};

const MasterRanker = async (evaluations) => {
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const prompt = `
You are the Executive Chairman of the IPL Governing Council. You have received the following team evaluations from our scouts.
Your job is to provide the FINAL, DEFINITIVE RANKING of these franchises.

Evaluations:
${evaluations.map(e => `- ${e.teamName}: Score ${e.evaluation.overallScore} | Verdict: ${e.evaluation.tacticalVerdict}`).join('\n')}

CRITICAL RULES:
1. **Strict Order**: You must rank them from 1 to ${evaluations.length} based on their performance and tactical quality.
2. **No Ties**: If scores are identical, you MUST decide who is better based on the 'Expert' logic (e.g., better bowling depth, more reliable anchor, etc.). 
3. **Tie-Breaker Reason**: If you move one team above another who has the same score, you MUST provide a short 'tieBreakerReason'.
4. **Non-Alphabetical**: Do NOT follow team name order. Look only at quality.

RESPOND ONLY WITH A VALID JSON ARRAY of objects:
[
  { "teamName": "Name", "rank": 1, "tieBreakerReason": "Optional if they were tied in score" },
  ...
]
`;

    try {
        console.log(`--- Master Ranker Starting ---`);
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const rankings = extractJSON(text);

        // Map rankings back to full data
        return evaluations.map(team => {
            const rankData = rankings.find(r => r.teamName === team.teamName);
            return {
                ...team,
                rank: rankData ? rankData.rank : 99,
                tieBreakerReason: rankData ? rankData.tieBreakerReason : null
            };
        }).sort((a, b) => a.rank - b.rank);

    } catch (error) {
        console.error('Error in Master Ranker:', error);
        // Fallback to basic sort
        return evaluations
            .sort((a, b) => b.evaluation.overallScore - a.evaluation.overallScore)
            .map((t, i) => ({ ...t, rank: i + 1 }));
    }
};

module.exports = { evaluateAllTeams, selectTop15 };
