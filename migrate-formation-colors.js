#!/usr/bin/env node
/**
 * Migration: Update all formation colors to use the new distinct palette.
 * Run: node migrate-formation-colors.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Formation = require('./models/Formation');

const FORMATION_COLOR_PALETTE = [
    '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4',
    '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
    '#f43f5e', '#64748b', '#0d9488', '#2563eb', '#7c3aed', '#be185d'
];

const FORMATION_PATTERNS = ['dots', 'hatching', 'triangles', 'diamonds', 'stripes-h', 'stripes-v', 'circles', 'grid', 'chevrons', 'waves', 'zigzag', 'cross', 'bricks', 'hexagons'];

function hashSeed(seed) {
    let hash = 0;
    const str = String(seed);
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function getColorForFormation(formation) {
    const index = hashSeed(formation._id.toString()) % FORMATION_COLOR_PALETTE.length;
    return FORMATION_COLOR_PALETTE[index];
}

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const formations = await Formation.find();
        console.log(`Found ${formations.length} formations to update`);

        for (let i = 0; i < formations.length; i++) {
            const f = formations[i];
            const newColor = getColorForFormation(f);
            const pattern = FORMATION_PATTERNS[i % FORMATION_PATTERNS.length];
            await Formation.findByIdAndUpdate(f._id, { color: newColor, pattern });
            console.log(`  Updated "${f.title}" -> ${newColor}, ${pattern}`);
        }

        console.log('Migration complete.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

migrate();
