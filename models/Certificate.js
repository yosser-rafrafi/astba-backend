const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    formation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Formation',
        required: true
    },
    issuedAt: {
        type: Date,
        default: Date.now
    },
    issuedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    certificateId: {
        type: String,
        unique: true,
        default: function () {
            return `CERT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Certificate', certificateSchema);
