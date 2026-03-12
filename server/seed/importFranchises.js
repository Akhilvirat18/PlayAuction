const mongoose = require('mongoose');
const Franchise = require('../models/Franchise');
require('dotenv').config({ path: '../.env' });

const dbUri = process.env.MONGO_URI;

const IPL_TEAMS = [
    { shortName: 'MI', name: 'Mumbai Indians', primaryColor: '#004BA0', secondaryColor: '#D1AB3E', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/c/cd/Mumbai_Indians_Logo.svg/1200px-Mumbai_Indians_Logo.svg.png' },
    { shortName: 'CSK', name: 'Chennai Super Kings', primaryColor: '#FFFF3C', secondaryColor: '#0081E9', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/2b/Chennai_Super_Kings_Logo.svg/1200px-Chennai_Super_Kings_Logo.svg.png' },
    { shortName: 'RCB', name: 'Royal Challengers Bengaluru', primaryColor: '#EC1C24', secondaryColor: '#000000', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d4/Royal_Challengers_Bengaluru_Logo.svg/330px-Royal_Challengers_Bengaluru_Logo.svg.png' },
    { shortName: 'KKR', name: 'Kolkata Knight Riders', primaryColor: '#2E0854', secondaryColor: '#B3A123', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4c/Kolkata_Knight_Riders_Logo.svg/1200px-Kolkata_Knight_Riders_Logo.svg.png' },
    { shortName: 'DC', name: 'Delhi Capitals', primaryColor: '#00008B', secondaryColor: '#174796', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/2f/Delhi_Capitals.svg/500px-Delhi_Capitals.svg.png' },
    { shortName: 'PBKS', name: 'Punjab Kings', primaryColor: '#ED1B24', secondaryColor: '#D7CA95', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d4/Punjab_Kings_Logo.svg/1200px-Punjab_Kings_Logo.svg.png' },
    { shortName: 'RR', name: 'Rajasthan Royals', primaryColor: '#EA1A85', secondaryColor: '#000000', purseLimit: 12000, logoUrl: 'https://scores.iplt20.com/ipl/teamlogos/RR.png' },
    { shortName: 'SRH', name: 'Sunrisers Hyderabad', primaryColor: '#FF822A', secondaryColor: '#000000', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/5/51/Sunrisers_Hyderabad_Logo.svg/500px-Sunrisers_Hyderabad_Logo.svg.png' },
    { shortName: 'LSG', name: 'Lucknow Super Giants', primaryColor: '#00D1FF', secondaryColor: '#F7A721', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a9/Lucknow_Super_Giants_IPL_Logo.svg/1200px-Lucknow_Super_Giants_IPL_Logo.svg.png' },
    { shortName: 'GT', name: 'Gujarat Titans', primaryColor: '#1B2133', secondaryColor: '#B3975A', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/09/Gujarat_Titans_Logo.svg/1200px-Gujarat_Titans_Logo.svg.png' },
    { shortName: 'DCG', name: 'Deccan Chargers', primaryColor: '#D1E1EF', secondaryColor: '#263238', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/a/a6/HyderabadDeccanChargers.png' },
    { shortName: 'KTK', name: 'Kochi Tuskers Kerala', primaryColor: '#F15A24', secondaryColor: '#8E288E', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/9/96/Kochi_Tuskers_Kerala_Logo.svg/500px-Kochi_Tuskers_Kerala_Logo.svg.png' },
    { shortName: 'PWI', name: 'Pune Warriors India', primaryColor: '#40E0D0', secondaryColor: '#2C2B29', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/4/4a/Pune_Warriors_India_IPL_Logo.png' },
    { shortName: 'RPS', name: 'Rising Pune Supergiant', primaryColor: '#D11D70', secondaryColor: '#FCCC04', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/9/9a/Rising_Pune_Supergiant.png' },
    { shortName: 'GL', name: 'Gujarat Lions', primaryColor: '#E04F16', secondaryColor: '#FFA500', purseLimit: 12000, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/c/c4/Gujarat_Lions.png' }
];

async function seed() {
    try {
        await mongoose.connect(dbUri);
        await Franchise.deleteMany({});
        await Franchise.insertMany(IPL_TEAMS);
        console.log('Successfully seeded 15 franchises to Atlas!');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

seed();
