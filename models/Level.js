const mongoose = require('mongoose');

const levelSchema = new mongoose.Schema({
    formation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Formation',
        required: true
    },
    order: {
        type: Number,
        required: true,
        min: 1,
        max: 4
    },
    title: {
        type: String,
        default: function () {
            return `Niveau ${this.order}`;
        }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Level', levelSchema);
