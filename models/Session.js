const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    formation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Formation',
        required: [true, 'Formation is required']
    },
    date: {
        type: Date,
        required: [true, 'Session date is required']
    },
    startTime: {
        type: String,
        required: [true, 'Start time is required']
    },
    endTime: {
        type: String,
        required: [true, 'End time is required']
    },
    formateur: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Formateur is required']
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    maxParticipants: {
        type: Number,
        default: 30
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Session', sessionSchema);
