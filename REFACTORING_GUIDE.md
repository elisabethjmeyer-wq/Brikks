# 🔧 Guide de Refactorisation — Module Entraînement

---

## 1. FIX MEMORY LEAK: Event Listeners Cleanup

### ❌ Actuel (Problématique)
```javascript
// setupTimelineDragDrop() - Ligne 1475
setupTimelineDragDrop(container) {
    const cards = container.querySelectorAll('.timeline-card');

    cards.forEach(card => {
        card.addEventListener('dragstart', ...);
        card.addEventListener('dragend', ...);
        card.addEventListener('dragover', ...);
    });
    // ❌ Listeners jamais supprimés!
}
```

### ✅ Corrigé
```javascript
// Ajouter une méthode cleanup
cleanupTimeline() {
    const container = document.getElementById('timelineCards');
    if (!container) return;

    // Méthode 1: Cloner les nœuds (supprime tous les listeners)
    const cards = Array.from(container.querySelectorAll('.timeline-card'));
    cards.forEach(card => {
        const newCard = card.cloneNode(true);
        card.parentNode.replaceChild(newCard, card);
    });
}

// Méthode 2: Utiliser EventListener Map (plus performant)
// Dans init():
this.eventListeners = new Map();

// Dans setupTimelineDragDrop():
setupTimelineDragDrop(container) {
    const cards = container.querySelectorAll('.timeline-card');

    cards.forEach(card => {
        const handlers = {};

        handlers.dragstart = (e) => {
            this.timelineDraggedCard = card;
            card.classList.add('dragging');
        };

        handlers.dragend = () => {
            card.classList.remove('dragging');
            this.saveTimelineOrder();
        };

        card.addEventListener('dragstart', handlers.dragstart);
        card.addEventListener('dragend', handlers.dragend);

        // Stocker pour cleanup
        if (!this.eventListeners.has(card)) {
            this.eventListeners.set(card, handlers);
        }
    });
}

// Dans cleanup:
cleanupTimeline() {
    this.eventListeners.forEach((handlers, card) => {
        Object.entries(handlers).forEach(([event, handler]) => {
            card.removeEventListener(event, handler);
        });
    });
    this.eventListeners.clear();
}

// Appeler dans nextEtape() et finishEntrainement():
nextEtape() {
    this.cleanupTimeline();  // ← IMPORTANT!
    // ... rest of logic
}
```

---

## 2. FIX MASSIVE FUNCTION: Split validateCurrentEtape()

### ❌ Actuel (700+ lignes)
```javascript
validateCurrentEtape() {
    // ... 700+ lignes de switch/case
    switch (format) {
        case 'qcm': /* 100 lignes */
        case 'vrai_faux': /* 100 lignes */
        case 'association': /* 80 lignes */
        // ...
    }
}
```

### ✅ Corrigé — Stratégie par Format
```javascript
// Créer une classe ValidatorFactory
class TrainingValidator {
    validateEtape(etape, donnees, userAnswers) {
        const format = etape.format_code;
        const validator = this.getValidator(format);
        return validator.validate(donnees, userAnswers);
    }

    getValidator(format) {
        const validators = {
            'qcm': new QCMValidator(),
            'vrai_faux': new VraiF auxValidator(),
            'association': new AssociationValidator(),
            'chronologie': new ChronologieValidator(),
            'texte_trous': new TexteT rousValidator(),
            'carte': new CarteValidator(),
            'question_ouverte': new QuestionOuverteValidator(),
            'flashcard': new FlashcardValidator()
        };
        return validators[format];
    }
}

// Chaque validateur < 100 lignes
class QCMValidator {
    validate(donnees, userAnswers) {
        const result = {
            correct: 0,
            total: 0,
            details: [],
            feedback: {}
        };

        const questions = donnees.multiQuestions || [donnees];

        questions.forEach((q, idx) => {
            result.total++;
            const userAnswer = userAnswers[`qcm_${idx}`];
            const isCorrect = this.checkAnswer(q, userAnswer);

            if (isCorrect) result.correct++;

            result.details.push({
                question: q.question,
                userAnswer: userAnswer,
                correct: isCorrect
            });

            result.feedback[idx] = this.generateFeedback(q, userAnswer, isCorrect);
        });

        return result;
    }

    checkAnswer(question, userAnswer) {
        // QCM-specific logic
        const choices = question.choix || question.options || [];
        const correctIndices = this.getCorrectIndices(question);
        return correctIndices.includes(parseInt(userAnswer));
    }

    generateFeedback(question, userAnswer, isCorrect) {
        // QCM-specific feedback
        if (isCorrect && question.feedback_correct) {
            return question.feedback_correct;
        }
        if (!isCorrect && question.feedback_incorrect) {
            return question.feedback_incorrect;
        }
        return isCorrect ? 'Correct ✓' : 'Incorrect ✗';
    }
}

// Utilisation dans EleveConnaissances:
async validateCurrentEtape() {
    if (this.currentEtapeValidated) return;

    const currentEtape = this.currentEtapes[this.currentEtapeIndex];
    const donnees = this.selectedQuestionsPerEtape[currentEtape.id]?.donnees;

    // Validation découlée (simple!)
    const result = this.validator.validateEtape(
        currentEtape,
        donnees,
        this.userAnswers
    );

    // Feedback unifié
    this.displayValidationFeedback(result);

    // Sauvegarde
    this.etapesResults[this.currentEtapeIndex] = result;
    this.currentEtapeValidated = true;
}
```

---

## 3. FIX FRAGMENTED STATE: Centralize State Management

### ❌ Actuel (11+ variables dispersées)
```javascript
EleveConnaissances = {
    userAnswers: {},
    etapesResults: [],
    selectedQuestionsPerEtape: {},
    currentEtapeValidated: false,
    _multiFormatState: null,
    _qcmResults: {},
    _qoResults: {},
    _vfResults: {},
    _vfNavIndex: 0,
    _qcmNavIndex: 0,
    _qoNavIndex: 0,
    // ❌ Réinitialisation incomplète partout
};
```

### ✅ Corrigé — State Manager
```javascript
class TrainingState {
    constructor() {
        this.reset();
    }

    reset() {
        this.state = {
            // Session
            currentEntrainement: null,
            currentEtapeIndex: 0,
            currentEtapeValidated: false,

            // User responses
            userAnswers: {},
            etapesResults: [],

            // Data
            selectedQuestionsPerEtape: {},

            // Format-specific state
            formats: {
                qcm: { results: {}, navIndex: 0 },
                vrai_faux: { results: {}, navIndex: 0 },
                association: {
                    pairs: [],
                    pairCounter: 0,
                    selection: { grid: null, chip: null }
                },
                texte_trous: { results: {} },
                chronologie: { results: {} },
                carte: { results: {}, activeIndex: 0 },
                question_ouverte: { results: {}, navIndex: 0 },
                flashcard: { results: {} }
            }
        };
    }

    // Getters/Setters pour accès sûr
    get currentEtapeValidated() {
        return this.state.currentEtapeValidated;
    }

    set currentEtapeValidated(value) {
        this.state.currentEtapeValidated = value;
    }

    getUserAnswers() {
        return this.state.userAnswers;
    }

    setUserAnswer(key, value) {
        this.state.userAnswers[key] = value;
    }

    getFormatState(format) {
        return this.state.formats[format] || {};
    }

    setFormatState(format, updates) {
        this.state.formats[format] = {
            ...this.state.formats[format],
            ...updates
        };
    }

    // Reset complet
    resetAll() {
        this.reset();
    }

    // Reset format-specific
    resetFormat(format) {
        const defaults = {
            qcm: { results: {}, navIndex: 0 },
            // ... etc
        };
        this.state.formats[format] = { ...defaults[format] };
    }
}

// Utilisation:
class EleveConnaissances {
    constructor() {
        this.stateManager = new TrainingState();
    }

    nextEtape() {
        this.stateManager.resetFormat('qcm');
        this.stateManager.resetFormat('association');
        // ...
    }

    finishEntrainement() {
        this.stateManager.resetAll();
    }
}
```

---

## 4. FIX ERROR HANDLING: Centralized Logger

### ❌ Actuel (Silencieux)
```javascript
try {
    const cached = localStorage.getItem(this.CACHE_KEY);
    const data = JSON.parse(cached);
} catch (e) { return null; }  // ❌ Aucun log!
```

### ✅ Corrigé
```javascript
// Logger service
class Logger {
    static DEBUG = true;

    static debug(component, message, data = null) {
        if (!this.DEBUG) return;
        console.log(`[${component}] ${message}`, data || '');
    }

    static error(component, message, error = null) {
        console.error(`[${component}] ❌ ${message}`, error || '');
        // Envoyer à monitoring service
        this.sendToMonitoring({
            component,
            message,
            error: error?.message || error,
            timestamp: new Date()
        });
    }

    static warn(component, message, data = null) {
        console.warn(`[${component}] ⚠️ ${message}`, data || '');
    }

    static sendToMonitoring(data) {
        // Envoyer à Google Apps Script ou service externe
        // fetch('/api/monitoring', { method: 'POST', body: JSON.stringify(data) })
    }
}

// Utilisation:
getFromCache() {
    try {
        const cached = localStorage.getItem(this.CACHE_KEY);
        if (!cached) {
            Logger.warn('EleveConnaissances', 'Cache not found');
            return null;
        }

        const data = JSON.parse(cached);
        if (data.timestamp && (Date.now() - data.timestamp) < this.CACHE_TTL) {
            Logger.debug('EleveConnaissances', 'Cache hit', { age: Date.now() - data.timestamp });
            return data;
        }
        return null;
    } catch (e) {
        Logger.error('EleveConnaissances', 'Cache read failed', e);
        return null;
    }
}
```

---

## 5. FIX INLINE HTML: Template System

### ❌ Actuel (HTML hardcodé)
```javascript
renderEtapeContent(currentEtape, donnees) {
    return `
        <div class="etape-feedback">
            <div class="feedback-icon">${isCorrect ? '✅' : '❌'}</div>
            <div class="feedback-text">${feedbackText}</div>
            <!-- 50+ lignes -->
        </div>
    `;
}
```

### ✅ Corrigé — Separation
```html
<!-- templates/etape-feedback.html -->
<template id="etape-feedback-template">
    <div class="etape-feedback">
        <div class="feedback-icon" data-icon=""></div>
        <div class="feedback-text" data-text=""></div>
        <div class="feedback-details">
            <p data-score=""></p>
        </div>
    </div>
</template>
```

```javascript
// Renderer class
class TrainingRenderer {
    renderEtapeFeedback(result) {
        const template = document.getElementById('etape-feedback-template');
        const clone = template.content.cloneNode(true);

        clone.querySelector('[data-icon]').textContent = result.correct ? '✅' : '❌';
        clone.querySelector('[data-text]').textContent = result.feedback;
        clone.querySelector('[data-score]').textContent = `${result.correct}/${result.total}`;

        return clone;
    }
}

// Utilisation:
validateCurrentEtape() {
    const result = this.validator.validateEtape(...);
    const feedbackHTML = this.renderer.renderEtapeFeedback(result);
    document.getElementById('etapeFeedback').appendChild(feedbackHTML);
}
```

---

## 6. Recommended Architecture Structure

```
eleve-connaissances/
├── index.js                    # Entry point
├── TrainingModule.js           # Main class
├── state/
│   └── TrainingState.js        # State management
├── services/
│   ├── DataService.js          # API calls
│   ├── CacheService.js         # Caching logic
│   └── Logger.js               # Logging
├── validators/
│   ├── TrainingValidator.js    # Factory
│   ├── QCMValidator.js
│   ├── VraiF auxValidator.js
│   ├── AssociationValidator.js
│   └── ...
├── renderers/
│   ├── TrainingRenderer.js     # Factory
│   ├── QCMRenderer.js
│   ├── FeedbackRenderer.js
│   └── ...
└── utils/
    ├── dom.js                  # DOM utilities
    ├── array.js                # Array utilities
    └── string.js               # String utilities
```

---

## 7. Migration Strategy

### Phase 1: Immediate (No Breaking Changes)
1. Add Logger service (no impact)
2. Create TrainingState class (add alongside existing state)
3. Add event listener cleanup helpers

### Phase 2: Refactor (Gradual)
4. Extract validators one by one
5. Create renderers
6. Migrate templates

### Phase 3: Complete
7. Remove old code
8. Add tests
9. Optimize performance

---

## 📋 Checklist de Conformité

- [ ] Pas de `console.log/warn/error` en production
- [ ] Chaque fonction < 100 lignes
- [ ] Tous les event listeners ont cleanup
- [ ] État centralisé en une seule source
- [ ] Try/catch avec logging
- [ ] Séparation data/render/logic
- [ ] Tests unitaires pour validators
- [ ] Documentation pour logic complexe
