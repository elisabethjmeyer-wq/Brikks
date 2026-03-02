'use strict';

/**
 * Tests for SubmissionUtils pure utility functions.
 * These functions handle date parsing and working day calculations.
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');

// Load SubmissionUtils from source, mocking the browser-only dependency (SheetsAPI)
const src = fs.readFileSync(path.join(__dirname, '../js/submission-utils.js'), 'utf8');
// Replace `const` with `var` so the vm sandbox exposes it on the context object
const modifiedSrc = src.replace(/^const SubmissionUtils\s*=/m, 'var SubmissionUtils =');
const context = { SheetsAPI: { fetchAndParse: () => Promise.resolve([]) }, console };
vm.createContext(context);
vm.runInContext(modifiedSrc, context);
const { SubmissionUtils } = context;

// ── _parseDate ────────────────────────────────────────────────────────────────

describe('SubmissionUtils._parseDate', () => {
    test('returns Date as-is', () => {
        const d = new Date(2025, 0, 15);
        expect(SubmissionUtils._parseDate(d).getTime()).toBe(d.getTime());
    });

    test('parses DD/MM/YYYY format', () => {
        const d = SubmissionUtils._parseDate('15/01/2025');
        expect(d.getFullYear()).toBe(2025);
        expect(d.getMonth()).toBe(0); // janvier
        expect(d.getDate()).toBe(15);
    });

    test('parses DD-MM-YYYY format', () => {
        const d = SubmissionUtils._parseDate('03-06-2024');
        expect(d.getFullYear()).toBe(2024);
        expect(d.getMonth()).toBe(5); // juin
        expect(d.getDate()).toBe(3);
    });

    test('parses YYYY-MM-DD (ISO) format', () => {
        const d = SubmissionUtils._parseDate('2025-09-01');
        expect(d.getFullYear()).toBe(2025);
        expect(d.getMonth()).toBe(8); // septembre
        expect(d.getDate()).toBe(1);
    });

    test('returns null for invalid input', () => {
        expect(SubmissionUtils._parseDate('not-a-date')).toBeNull();
        expect(SubmissionUtils._parseDate('')).toBeNull();
    });
});

// ── _toKey ────────────────────────────────────────────────────────────────────

describe('SubmissionUtils._toKey', () => {
    test('formats date as YYYY-MM-DD', () => {
        expect(SubmissionUtils._toKey(new Date(2025, 0, 5))).toBe('2025-01-05');
        expect(SubmissionUtils._toKey(new Date(2025, 11, 31))).toBe('2025-12-31');
    });

    test('zero-pads month and day', () => {
        expect(SubmissionUtils._toKey(new Date(2024, 2, 7))).toBe('2024-03-07');
    });
});

// ── _isJourOuvre ─────────────────────────────────────────────────────────────

describe('SubmissionUtils._isJourOuvre', () => {
    // 2025-01-13 is a Monday
    const lundi = new Date(2025, 0, 13);
    // 2025-01-11 is a Saturday
    const samedi = new Date(2025, 0, 11);
    // 2025-01-12 is a Sunday
    const dimanche = new Date(2025, 0, 12);

    test('Monday is a working day', () => {
        expect(SubmissionUtils._isJourOuvre(lundi, new Set())).toBe(true);
    });

    test('Saturday is not a working day', () => {
        expect(SubmissionUtils._isJourOuvre(samedi, new Set())).toBe(false);
    });

    test('Sunday is not a working day', () => {
        expect(SubmissionUtils._isJourOuvre(dimanche, new Set())).toBe(false);
    });

    test('a weekday listed in joursNonCours is not a working day', () => {
        const ferme = new Set(['2025-01-13']);
        expect(SubmissionUtils._isJourOuvre(lundi, ferme)).toBe(false);
    });

    test('works with null joursNonCours', () => {
        expect(SubmissionUtils._isJourOuvre(lundi, null)).toBe(true);
    });
});

// ── prochainJourOuvre ─────────────────────────────────────────────────────────

describe('SubmissionUtils.prochainJourOuvre', () => {
    test('returns a Date in the future', () => {
        const result = SubmissionUtils.prochainJourOuvre(1, new Set());
        expect(typeof result.getTime).toBe('function');
        expect(result.getTime()).toBeGreaterThan(Date.now());
    });

    test('the result is a working day (not a weekend)', () => {
        const result = SubmissionUtils.prochainJourOuvre(1, new Set());
        const day = result.getDay();
        expect(day).not.toBe(0); // not Sunday
        expect(day).not.toBe(6); // not Saturday
    });

    test('skips a day listed in joursNonCours', () => {
        // Build a set containing every weekday for the next 30 days except one
        // to ensure the function skips those days
        const joursNonCours = new Set();
        const today = new Date();
        // Block 5 consecutive days starting from tomorrow
        for (let i = 1; i <= 5; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            joursNonCours.add(SubmissionUtils._toKey(d));
        }
        const result = SubmissionUtils.prochainJourOuvre(1, joursNonCours);
        // Result should not be in the blocked days
        expect(joursNonCours.has(SubmissionUtils._toKey(result))).toBe(false);
    });
});

// ── buildDeliveryHTML ─────────────────────────────────────────────────────────

describe('SubmissionUtils.buildDeliveryHTML', () => {
    test('returns HTML containing deadline text', () => {
        const html = SubmissionUtils.buildDeliveryHTML('numerique', 'avant 15h30');
        expect(html).toContain('avant 15h30');
        expect(html).toContain('MBN');
    });

    test('paper mode mentions dépôt de copie', () => {
        const html = SubmissionUtils.buildDeliveryHTML('papier', 'le lundi 3 mars 2025');
        expect(html).toContain('le lundi 3 mars 2025');
        expect(html).toContain('casier');
    });
});
