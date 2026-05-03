const mongoose = require('mongoose');

const ecoSchema = new mongoose.Schema({
    userId: { 
        type: String, 
        required: true, 
        unique: true 
    },
    cash: { 
        type: Number, 
        default: 0 
    },
    bank: { 
        type: Number, 
        default: 0 
    },
    lastDaily: { 
        type: Date 
    },
    lastCollect: {
        type: Date
    },
    lastWork: {
        type: Date
    },
    lastRob: {
        type: Date
    },
    lastSlut: {
        type: Date
    },
    workStreak: {
        type: Number,
        default: 0
    },
    starterEcoGivenBefore: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('Eco', ecoSchema);
