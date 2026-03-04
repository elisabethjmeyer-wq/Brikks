#!/usr/bin/env node

/**
 * Concatène tous les fichiers .gs en un seul TOUT-EN-UN.gs
 * Usage : npm run build:gas
 */

const fs = require('fs');
const path = require('path');

const GAS_DIR = path.join(__dirname, '..', 'google-apps-script');
const OUTPUT = path.join(GAS_DIR, 'TOUT-EN-UN.gs');

// Code.gs en premier (contient les constantes SHEETS, SPREADSHEET_ID, etc.)
// puis les autres par ordre alphabétique
const files = fs.readdirSync(GAS_DIR)
    .filter(f => f.endsWith('.gs') && f !== 'TOUT-EN-UN.gs')
    .sort((a, b) => {
        if (a === 'Code.gs') return -1;
        if (b === 'Code.gs') return 1;
        return a.localeCompare(b);
    });

const header = `// ================================================================
// FICHIER AUTO-GÉNÉRÉ — ne pas modifier directement
// Généré par : npm run build:gas
// Date : ${new Date().toISOString().split('T')[0]}
// ================================================================
`;

let output = header;

for (const file of files) {
    const content = fs.readFileSync(path.join(GAS_DIR, file), 'utf8');
    output += `\n// ================================================================\n`;
    output += `// FILE: ${file}\n`;
    output += `// ================================================================\n\n`;
    output += content.trimEnd() + '\n';
}

fs.writeFileSync(OUTPUT, output, 'utf8');

const lines = output.split('\n').length;
console.log(`TOUT-EN-UN.gs généré (${files.length} fichiers, ${lines} lignes)`);
