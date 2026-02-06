const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    session: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Session',
        required: [true, 'Session is required']
    },
    participant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Participant is required']
    },
    status: {
        type: String,
        enum: ['present', 'absent', 'late'],
        default: 'absent'
    },
    markedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Ensure one attendance record per participant per session
attendanceSchema.index({ session: 1, participant: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
