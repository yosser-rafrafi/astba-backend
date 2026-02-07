const mongoose = require('mongoose');

// Unique pattern identifiers for color-blind accessibility (one per formation)
const FORMATION_PATTERNS = ['dots', 'hatching', 'triangles', 'diamonds', 'stripes-h', 'stripes-v', 'circles', 'grid', 'chevrons', 'waves', 'zigzag', 'cross', 'bricks', 'hexagons'];

// Curated palette of perceptually distinct colors (avoids similar greens/blues clustering)
const FORMATION_COLOR_PALETTE = [
    '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4',
    '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
    '#f43f5e', '#64748b', '#0d9488', '#2563eb', '#7c3aed', '#be185d'
];

function hashSeed(seed) {
    let hash = 0;
    const str = String(seed);
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function generateFormationColor(seed) {
    const index = hashSeed(seed) % FORMATION_COLOR_PALETTE.length;
    return FORMATION_COLOR_PALETTE[index];
}

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
    },
    defaultFormateur: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    color: {
        type: String,
        default: function () {
            return generateFormationColor(this.title + Date.now());
        }
    },
    pattern: {
        type: String,
        enum: ['dots', 'hatching', 'triangles', 'diamonds', 'stripes-h', 'stripes-v', 'circles', 'grid', 'chevrons', 'waves', 'zigzag', 'cross', 'bricks', 'hexagons'],
        default: 'dots'
    }
}, {
    timestamps: true
});

// Ensure color and pattern are set for existing formations on first save (migration helper)
formationSchema.pre('save', function (next) {
    if (!this.color) {
        this.color = generateFormationColor(this._id?.toString() || this.title);
    }
    if (!this.pattern) {
        const idx = hashSeed(this._id?.toString() || this.title) % FORMATION_PATTERNS.length;
        this.pattern = FORMATION_PATTERNS[idx];
    }
    next();
});

module.exports = mongoose.model('Formation', formationSchema);
