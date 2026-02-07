const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// @route   POST /api/voice/command
// @desc    Process voice command and return structured action
// @access  Private
router.post('/command', authenticate, async (req, res) => {
    try {
        const { pageContext, focusedElement, userInput } = req.body;

        if (!userInput) {
            return res.status(400).json({ error: 'User input is required' });
        }

        const input = userInput.toLowerCase().trim();
        console.log('Voice command received:', input);

        // Process command
        const action = processVoiceCommand(input, pageContext, focusedElement);

        res.json(action);
    } catch (error) {
        console.error('Voice command processing error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * Process voice command
 */
/**
 * Process voice command
 */
function processVoiceCommand(input, pageContext, focusedElement) {
    const normalized = normalizeVoiceInput(input);
    console.log('Normalized input:', normalized);

    // 0. EXPLICIT STOP/CANCEL (Safety)
    if (checkKeyword(normalized, ['stop', 'arrête', 'annule'])) {
        return { action: 'stop', target: null, value: null, confidence: 1 };
    }

    // 1. Navigation (Check this FIRST because "page" might be in the destination)
    if (checkKeyword(normalized, ['aller', 'va', 'navigue', 'ouvrir', 'montre', 'voir', 'accueil'])) {
        const destMatch = normalized.match(/(?:aller|va|navigue|ouvre|ouvrir|vers|voir|montre)\s+(?:à|au|aux|sur|la|le|les|page\s+de|page)\s*(.+)/i);
        if (destMatch) {
            return {
                action: 'navigate',
                target: destMatch[1].trim(),
                value: null,
                confidence: 0.85
            };
        }
        if (normalized.includes('accueil')) {
            return { action: 'navigate', target: 'accueil', confidence: 0.9 };
        }
    }

    // 2. Fill Fields (PRIORITY OVER CLICKS)
    if (checkKeyword(normalized, ['écri', 'marqu', 'met', 'rempli', 'entr', 'saisir', 'est', 'mon', 'ma'])) {
        // Complex regex to catch "fill [field] with [value]" OR "my [field] is [value]"

        // Case A: "remplir [field] avec [value]"
        let match = normalized.match(/(?:rempli|remplis|remplir|entre|entrer|saisir|mettre|met)\s+(?:le|la|l'|les\s+)?(.+?)\s+(?:avec|par|:|est|vaut)\s*(.+)/i);

        // Case B: "écrire [value] dans [field]"
        if (!match) {
            match = normalized.match(/(?:écri|écris|écrire|taper)\s+(.+?)\s+(?:dans|sur|pour)\s+(?:le|la|l'|champ\s+)?(.+)/i);
            if (match) {
                const temp = match[1];
                match[1] = match[2];
                match[2] = temp;
            }
        }

        // Case C: "mon [field] est [value]"
        if (!match) {
            match = normalized.match(/(?:mon|ma|le|la)\s+(.+?)\s+(?:est)\s*(.+)/i);
        }

        if (match) {
            const fieldRaw = match[1].trim();
            const valueRaw = match[2].trim();

            const targetField = findBestFieldMatch(fieldRaw, pageContext);
            const formattedValue = formatValueForField(valueRaw, targetField);

            console.log(`Fill Intent detected. Raw Field: "${fieldRaw}" -> Matched: "${targetField}". Value: "${formattedValue}"`);

            if (targetField) {
                return {
                    action: 'fill_field',
                    target: targetField,
                    value: formattedValue,
                    confidence: 0.85
                };
            } else {
                // IMPORTANT: If we detected a fill intent but couldn't match a field, 
                // DO NOT fall through to click logic if the input contains "connecter" or "login"
                // It's likely a misinterpretation of "remplir email pour se connecter"
                return {
                    action: 'ask_clarification',
                    target: null,
                    value: `Je ne trouve pas le champ "${fieldRaw}".`,
                    confidence: 0.5
                };
            }
        }
    }

    // 3. Click / Action (STRICTER with bilingual support)
    if (checkKeyword(normalized, ['clique', 'appu', 'press', 'valid', 'envoy', 'connect', 's\'inscri', 'login', 'click', 'return', 'retour'])) {

        let target = normalized;
        let isExplicitClick = checkKeyword(normalized, ['clique', 'appu', 'press', 'valid', 'click']);

        // Remove verbs (French and English)
        target = target.replace(/^(clique|cliquer|appuie|appuyer|presse|presser|valide|valider|click|sur|le|la|bouton|button|on|the)\s+/g, '').trim();

        // Handle common shortcuts and translations
        let overrideTarget = null;
        if (checkKeyword(normalized, ['connect', 'login', 'log in', 'connexion'])) overrideTarget = 'log in';
        if (checkKeyword(normalized, ['inscri', 'sign up', 'signup'])) overrideTarget = 'request access';
        if (checkKeyword(normalized, ['return', 'retour', 'back'])) overrideTarget = 'return to login';
        if (checkKeyword(normalized, ['submit', 'valide', 'envoyer'])) overrideTarget = 'submit';

        // PREVENT "remplir email" from triggering "se connecter"
        if (!isExplicitClick && !overrideTarget) {
            return {
                action: 'ask_clarification',
                target: null,
                value: "Voulez-vous cliquer sur un bouton ?",
                confidence: 0.3
            };
        }

        return {
            action: 'click_button',
            target: overrideTarget || target,
            value: null,
            confidence: 0.90
        };
    }

    // 4. Read Page
    if (checkKeyword(normalized, ['lire', 'lis', 'contenu', 'décrir', 'quoi'])) {
        return {
            action: 'read_page',
            target: null,
            value: null,
            confidence: 0.95
        };
    }

    // 5. Scroll / Focus
    if (checkKeyword(normalized, ['descend', 'bas'])) return { action: 'scroll', target: 'down', confidence: 0.9 };
    if (checkKeyword(normalized, ['monte', 'haut'])) return { action: 'scroll', target: 'up', confidence: 0.9 };

    return {
        action: 'ask_clarification',
        target: null,
        value: null,
        confidence: 0
    };
}

/**
 * Fuzzy check if input contains any of the keywords
 */
function checkKeyword(input, keywords) {
    return keywords.some(k => input.includes(k));
}

/**
 * Clean up user input for easier processing
 */
function normalizeVoiceInput(input) {
    let s = input.toLowerCase();

    // Email specific normalizations
    s = s.replace(/\s+arobase\s+/g, '@')
        .replace(/\s+at\s+/g, '@')
        .replace(/à/g, '@') // simple 'à' often means '@' in email context if isolated, but be careful
        .replace(/\s+point\s+/g, '.')
        .replace(/\s+dot\s+/g, '.');

    // Remove accents
    s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return s.trim();
}

/**
 * Find the best matching field ID from the page context
 */
function findBestFieldMatch(spokenField, pageContext) {
    if (!pageContext || !pageContext.formFields) return null;

    const query = spokenField.toLowerCase().replace(/\s+/g, '');
    let bestMatch = null;
    let bestScore = 0;

    pageContext.formFields.forEach(field => {
        let score = 0;
        const candidates = [
            field.id,
            field.name,
            field.label,
            field.placeholder,
            field.type // e.g., 'email', 'password'
        ].filter(Boolean).map(c => c.toLowerCase().replace(/\s+/g, ''));

        candidates.forEach(c => {
            if (c === query) score = 100; // Exact match
            else if (c.includes(query)) score = 80; // Contains
            else if (query.includes(c)) score = 70; // Reverse contains

            // Simple Levenshtein-like check could go here, but containment is usually enough for now
        });

        if (score > bestScore) {
            bestScore = score;
            bestMatch = field.id || field.name;
        }
    });

    return bestMatch;
}

/**
 * Format value based on target field type (e.g. email)
 */
function formatValueForField(value, fieldId) {
    let v = value;
    if (fieldId && (fieldId.toLowerCase().includes('email') || fieldId.toLowerCase().includes('mail'))) {
        v = v.replace(/\s+/g, '').toLowerCase(); // Remove spaces for emails
        // Fix common email symbol mishaps again just in case
        v = v.replace(/à/g, '@');
    }
    return v;
}

module.exports = router;
