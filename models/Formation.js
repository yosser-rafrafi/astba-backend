const mongoose = require('mongoose');

const formationSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Formation title is required'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true
    },
    duration: {
        type: Number, // Duration in hours
        required: [true, 'Duration is required'],
        min: [1, 'Duration must be at least 1 hour']
    },
    startDate: {
        type: Date,
        default: Date.now,
        required: [true, 'Start date is required']
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Formation', formationSchema);
