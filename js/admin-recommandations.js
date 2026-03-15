/**
 * Admin Recommandations - Gestion des recommandations
 */

const AdminRecommandations = {
    // Données
    recos: [],
    featuredRecoId: null,
    displayEnabled: true,
    selectionMode: 'auto', // 'auto' ou 'manual'

    // État d'édition
    editingRecoId: null,
    deletingRecoId: null,

    // Icônes par type
    typeIcons: {
        podcast: '🎧',
        video: '🎬',
        livre: '📖',
        article: '📰',
        autre: '📌'
    },

    /**
     * Initialise la page
     */
    async init() {
        try {
            await this.loadData();
            this.renderFeaturedReco();
            this.renderRecosList();
            this.bindEvents();
            this.showContent();
        } catch (error) {
            console.error('Erreur lors du chargement:', error);
            this.showError('Erreur lors du chargement des données');
        }
    },

    /**
     * Charge les données depuis Google Sheets
     */
    async loadData() {
        const [recos, parametres] = await Promise.all([
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.RECOMMANDATIONS),
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.PARAMETRES)
        ]);

        // Lire le paramètre reco_accueil (défaut TRUE)
        const paramRecoAccueil = (parametres || []).find(p => p.cle === 'reco_accueil');
        this.displayEnabled = !paramRecoAccueil || paramRecoAccueil.valeur !== 'FALSE';

        // Trier par date de publication (plus récente en premier)
        this.recos = (recos || []).sort((a, b) => {
            const dateA = new Date(a.date_publication || 0);
            const dateB = new Date(b.date_publication || 0);
            return dateB - dateA;
        });

        // Déterminer la recommandation mise en avant
        const featured = this.recos.find(r => r.est_featured === 'TRUE' || r.est_featured === true);
        if (featured) {
            this.featuredRecoId = featured.id;
            this.selectionMode = 'manual';
        } else if (this.recos.length > 0) {
            // Par défaut, la plus récente
            this.featuredRecoId = this.recos[0].id;
            this.selectionMode = 'auto';
        }

    },

    /**
     * Affiche le contenu principal
     */
    showContent() {
        const loader = document.getElementById('loader');
        const content = document.getElementById('reco-content');
        if (loader) loader.style.display = 'none';
        if (content) content.style.display = 'block';
    },

    /**
     * Affiche une erreur
     */
    showError(message) {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.innerHTML = `<div style="color: #ef4444; text-align: center;"><p style="font-size: 48px;">⚠️</p><p>${message}</p></div>`;
        }
    },

    /**
     * Affiche la recommandation mise en avant
     */
    renderFeaturedReco() {
        // Synchroniser le toggle avec l'état chargé
        const toggleEl = document.getElementById('toggleDisplay');
        if (toggleEl) {
            toggleEl.classList.toggle('active', this.displayEnabled);
        }

        const section = document.getElementById('currentRecoSection');
        const noRecoState = document.getElementById('noRecoState');
        const content = document.getElementById('currentRecoContent');
        const modeBadge = document.getElementById('modeBadge');

        if (this.recos.length === 0) {
            if (section) section.style.display = 'none';
            if (noRecoState) noRecoState.style.display = 'block';
            return;
        }

        if (section) section.style.display = 'block';
        if (noRecoState) noRecoState.style.display = 'none';

        // Mettre à jour le badge mode
        if (modeBadge) {
            modeBadge.textContent = this.selectionMode === 'auto' ? 'AUTO' : 'MANUEL';
            modeBadge.className = this.selectionMode === 'auto' ? 'auto-badge' : 'manual-badge';
        }

        const featuredReco = this.recos.find(r => r.id === this.featuredRecoId) || this.recos[0];

        if (content && featuredReco) {
            const typeIcon = this.typeIcons[featuredReco.type] || '📌';
            const imageUrl = this.getDirectImageUrl(featuredReco.image_url);
            const imageHtml = imageUrl
                ? `<img src="${imageUrl}" alt="${escapeHtml(featuredReco.titre)}">`
                : `<span class="type-icon">${typeIcon}</span>`;

            content.innerHTML = `
                <div class="current-reco-thumb">
                    ${imageHtml}
                </div>
                <div class="current-reco-info">
                    <div class="current-reco-title">${escapeHtml(featuredReco.titre)}</div>
                    <div class="current-reco-type">
                        <span class="badge">${typeIcon} ${this.capitalizeFirst(featuredReco.type || 'autre')}</span>
                        <span>•</span>
                        <span>Ajoutée le ${this.formatDate(featuredReco.date_publication)}</span>
                    </div>
                </div>
                <div class="current-reco-actions">
                    <button class="btn btn-outline btn-sm" onclick="AdminRecommandations.openSelectModal()">
                        🔄 Changer
                    </button>
                    <button class="btn btn-ghost btn-sm" onclick="AdminRecommandations.openUrl('${featuredReco.url}')" title="Ouvrir le lien">
                        🔗
                    </button>
                </div>
            `;
        }
    },

    /**
     * Affiche la liste des recommandations
     */
    renderRecosList() {
        const list = document.getElementById('recosList');
        const emptyState = document.getElementById('emptyState');
        const count = document.getElementById('recosCount');

        if (count) {
            count.textContent = `${this.recos.length} recommandation${this.recos.length > 1 ? 's' : ''}`;
        }

        if (this.recos.length === 0) {
            if (list) list.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (list) list.style.display = 'flex';
        if (emptyState) emptyState.style.display = 'none';

        const filteredRecos = this.getFilteredRecos();

        if (list) {
            list.innerHTML = filteredRecos.map(reco => {
                const isFeatured = reco.id === this.featuredRecoId;
                const typeIcon = this.typeIcons[reco.type] || '📌';
                const imageUrl = this.getDirectImageUrl(reco.image_url);
                const imageHtml = imageUrl
                    ? `<img src="${imageUrl}" alt="">`
                    : `<span class="type-icon">${typeIcon}</span>`;

                return `
                    <div class="reco-item ${isFeatured ? 'featured' : ''}" data-id="${reco.id}">
                        <span class="reco-drag">⋮⋮</span>
                        <div class="reco-thumb">
                            ${imageHtml}
                        </div>
                        <div class="reco-info">
                            <div class="reco-title">
                                ${isFeatured ? '<span class="star">⭐</span>' : ''}
                                ${escapeHtml(reco.titre)}
                            </div>
                            <div class="reco-meta">
                                <span class="type-badge">${typeIcon} ${this.capitalizeFirst(reco.type || 'autre')}</span>
                                <span>•</span>
                                <span>${this.formatDate(reco.date_publication)}</span>
                            </div>
                        </div>
                        <div class="reco-actions">
                            ${!isFeatured ? `<button class="action-btn star" onclick="AdminRecommandations.setFeatured('${reco.id}')" title="Mettre en avant">⭐</button>` : ''}
                            <button class="action-btn" onclick="AdminRecommandations.openUrl('${reco.url}')" title="Ouvrir">🔗</button>
                            <button class="action-btn" onclick="AdminRecommandations.editReco('${reco.id}')" title="Modifier">✏️</button>
                            <button class="action-btn danger" onclick="AdminRecommandations.confirmDelete('${reco.id}')" title="Supprimer">🗑️</button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    },

    /**
     * Récupère les recommandations filtrées
     */
    getFilteredRecos() {
        const searchInput = document.getElementById('searchInput');
        const filterType = document.getElementById('filterType');

        const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const type = filterType ? filterType.value : 'all';

        return this.recos.filter(reco => {
            // Filtre recherche
            if (search && !reco.titre.toLowerCase().includes(search) &&
                !(reco.description || '').toLowerCase().includes(search)) {
                return false;
            }

            // Filtre type
            if (type !== 'all' && reco.type !== type) {
                return false;
            }

            return true;
        });
    },

    /**
     * Lie les événements
     */
    bindEvents() {
        // Bouton nouvelle reco
        document.getElementById('addRecoBtn')?.addEventListener('click', () => this.openAddModal());

        // Toggle affichage
        document.getElementById('toggleDisplay')?.addEventListener('click', () => this.toggleDisplay());

        // Recherche et filtres
        document.getElementById('searchInput')?.addEventListener('input', () => this.renderRecosList());
        document.getElementById('filterType')?.addEventListener('change', () => this.renderRecosList());

        // Modal reco
        document.getElementById('closeRecoModal')?.addEventListener('click', () => this.closeRecoModal());
        document.getElementById('cancelRecoBtn')?.addEventListener('click', () => this.closeRecoModal());
        document.getElementById('saveRecoBtn')?.addEventListener('click', () => this.saveReco());

        // Prévisualisation image
        document.getElementById('recoImage')?.addEventListener('input', (e) => this.updateImagePreview(e.target.value));

        // Modal sélection
        document.getElementById('closeSelectModal')?.addEventListener('click', () => this.closeSelectModal());
        document.getElementById('cancelSelectBtn')?.addEventListener('click', () => this.closeSelectModal());
        document.getElementById('applySelectBtn')?.addEventListener('click', () => this.applySelection());

        // Modal suppression
        document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => this.deleteReco());

        // Fermer modals au clic sur overlay
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.add('hidden');
                }
            });
        });
    },

    /**
     * Toggle l'affichage sur la page d'accueil — sauvegarde dans PARAMETRES
     */
    async toggleDisplay() {
        const toggle = document.getElementById('toggleDisplay');
        toggle.classList.toggle('active');
        this.displayEnabled = toggle.classList.contains('active');

        try {
            await this.callWebApp('updateParametres', [
                { cle: 'reco_accueil', valeur: this.displayEnabled ? 'TRUE' : 'FALSE' }
            ]);
            SheetsAPI.clearCacheFor(CONFIG.SHEETS.PARAMETRES);
        } catch (err) {
            console.error('[AdminRecos] Erreur sauvegarde toggle:', err);
            toggle.classList.toggle('active');
            this.displayEnabled = !this.displayEnabled;
            alert('Erreur lors de la sauvegarde du paramètre');
        }
    },

    /**
     * Ouvre le modal d'ajout
     */
    openAddModal() {
        this.editingRecoId = null;
        document.getElementById('modalTitle').textContent = '💡 Nouvelle recommandation';
        document.getElementById('recoId').value = '';
        document.getElementById('recoTitre').value = '';
        document.getElementById('recoType').value = '';
        document.getElementById('recoDescription').value = '';
        document.getElementById('recoUrl').value = '';
        document.getElementById('recoImage').value = '';
        document.getElementById('recoDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('recoTags').value = '';

        this.updateImagePreview('');
        document.getElementById('recoModal').classList.remove('hidden');
    },

    /**
     * Ouvre le modal d'édition
     */
    editReco(recoId) {
        const reco = this.recos.find(r => r.id === recoId);
        if (!reco) return;

        this.editingRecoId = recoId;
        document.getElementById('modalTitle').textContent = '✏️ Modifier la recommandation';
        document.getElementById('recoId').value = reco.id;
        document.getElementById('recoTitre').value = reco.titre || '';
        document.getElementById('recoType').value = reco.type || '';
        document.getElementById('recoDescription').value = reco.description || '';
        document.getElementById('recoUrl').value = reco.url || '';
        document.getElementById('recoImage').value = reco.image_url || '';
        document.getElementById('recoDate').value = reco.date_publication || '';
        document.getElementById('recoTags').value = reco.tags || '';

        this.updateImagePreview(reco.image_url || '');
        document.getElementById('recoModal').classList.remove('hidden');
    },

    /**
     * Ferme le modal reco
     */
    closeRecoModal() {
        document.getElementById('recoModal').classList.add('hidden');
        this.editingRecoId = null;
    },

    /**
     * Met à jour la prévisualisation image
     */
    updateImagePreview(url) {
        const preview = document.getElementById('imagePreview');
        if (!preview) return;

        const directUrl = this.getDirectImageUrl(url);

        // Vérifier si c'est une image (extension ou Google Drive)
        const isImage = url && (
            url.match(/\.(jpg|jpeg|png|gif|webp)/i) ||
            url.includes('drive.google.com')
        );

        if (isImage && directUrl) {
            preview.classList.add('has-image');
            preview.innerHTML = `<img src="${directUrl}" alt="Aperçu" onerror="this.parentElement.innerHTML='<span>Image invalide</span>'; this.parentElement.classList.remove('has-image');">`;
        } else {
            preview.classList.remove('has-image');
            preview.innerHTML = '<span>Aperçu image</span>';
        }
    },

    /**
     * Sauvegarde une recommandation
     */
    async saveReco() {
        const titre = document.getElementById('recoTitre').value.trim();
        const type = document.getElementById('recoType').value;
        const description = document.getElementById('recoDescription').value.trim();
        const url = document.getElementById('recoUrl').value.trim();
        const imageUrl = document.getElementById('recoImage').value.trim();
        const date = document.getElementById('recoDate').value;
        const tags = document.getElementById('recoTags').value.trim();

        if (!titre || !type || !description || !url) {
            alert('Veuillez remplir tous les champs obligatoires.');
            return;
        }

        const saveBtn = document.getElementById('saveRecoBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Enregistrement...';

        try {
            const recoData = {
                titre,
                type,
                description,
                url,
                image_url: imageUrl,
                date_publication: date,
                tags,
                est_featured: 'FALSE'
            };

            if (this.editingRecoId) {
                // Mise à jour
                recoData.id = this.editingRecoId;
                await this.callWebApp('updateRecommandation', recoData);
            } else {
                // Création
                await this.callWebApp('createRecommandation', recoData);
            }

            // Vider le cache pour que les modifications soient visibles immédiatement
            SheetsAPI.clearCache();

            // Recharger les données
            await this.loadData();
            this.renderFeaturedReco();
            this.renderRecosList();
            this.closeRecoModal();

        } catch (error) {
            console.error('Erreur lors de la sauvegarde:', error);
            alert('Erreur lors de la sauvegarde: ' + error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = '✓ Enregistrer';
        }
    },

    /**
     * Ouvre le modal de confirmation de suppression
     */
    confirmDelete(recoId) {
        const reco = this.recos.find(r => r.id === recoId);
        if (!reco) return;

        this.deletingRecoId = recoId;
        document.getElementById('deleteConfirmText').textContent =
            `Voulez-vous vraiment supprimer "${reco.titre}" ?`;
        document.getElementById('deleteModal').classList.remove('hidden');
    },

    /**
     * Ferme le modal de suppression
     */
    closeDeleteModal() {
        document.getElementById('deleteModal').classList.add('hidden');
        this.deletingRecoId = null;
    },

    /**
     * Supprime une recommandation
     */
    async deleteReco() {
        if (!this.deletingRecoId) return;

        const deleteBtn = document.getElementById('confirmDeleteBtn');
        deleteBtn.disabled = true;
        deleteBtn.textContent = 'Suppression...';

        try {
            await this.callWebApp('deleteRecommandation', { id: this.deletingRecoId });

            // Vider le cache pour que les modifications soient visibles immédiatement
            SheetsAPI.clearCache();

            // Recharger les données
            await this.loadData();
            this.renderFeaturedReco();
            this.renderRecosList();
            this.closeDeleteModal();

        } catch (error) {
            console.error('Erreur lors de la suppression:', error);
            alert('Erreur lors de la suppression: ' + error.message);
        } finally {
            deleteBtn.disabled = false;
            deleteBtn.textContent = '🗑️ Supprimer';
        }
    },

    /**
     * Définit une recommandation comme mise en avant
     */
    async setFeatured(recoId) {
        try {
            // Retirer le featured de l'ancienne reco
            if (this.featuredRecoId) {
                await this.callWebApp('updateRecommandation', {
                    id: this.featuredRecoId,
                    est_featured: 'FALSE'
                });
            }

            // Mettre le featured sur la nouvelle
            await this.callWebApp('updateRecommandation', {
                id: recoId,
                est_featured: 'TRUE'
            });

            // Vider le cache pour que les modifications soient visibles immédiatement
            SheetsAPI.clearCache();

            this.featuredRecoId = recoId;
            this.selectionMode = 'manual';

            // Recharger
            await this.loadData();
            this.renderFeaturedReco();
            this.renderRecosList();

        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur: ' + error.message);
        }
    },

    /**
     * Ouvre le modal de sélection
     */
    openSelectModal() {
        const selectList = document.getElementById('selectList');

        // Sélectionner le bon radio
        const autoRadio = document.querySelector('input[name="recoMode"][value="auto"]');
        if (autoRadio) autoRadio.checked = (this.selectionMode === 'auto');

        // Générer la liste
        if (selectList) {
            selectList.innerHTML = this.recos.map(reco => {
                const typeIcon = this.typeIcons[reco.type] || '📌';
                return `
                    <label class="select-item">
                        <input type="radio" name="recoMode" value="${reco.id}"
                               ${this.selectionMode === 'manual' && this.featuredRecoId === reco.id ? 'checked' : ''}>
                        <div class="select-item-info">
                            <div class="select-item-title">${typeIcon} ${escapeHtml(reco.titre)}</div>
                            <div class="select-item-type">${this.capitalizeFirst(reco.type || 'autre')} • ${this.formatDate(reco.date_publication)}</div>
                        </div>
                    </label>
                `;
            }).join('');
        }

        document.getElementById('selectModal').classList.remove('hidden');
    },

    /**
     * Ferme le modal de sélection
     */
    closeSelectModal() {
        document.getElementById('selectModal').classList.add('hidden');
    },

    /**
     * Applique la sélection
     */
    async applySelection() {
        const selected = document.querySelector('input[name="recoMode"]:checked');
        if (!selected) return;

        const applyBtn = document.getElementById('applySelectBtn');
        applyBtn.disabled = true;
        applyBtn.textContent = 'Application...';

        try {
            if (selected.value === 'auto') {
                // Mode auto : retirer tous les featured
                for (const reco of this.recos) {
                    if (reco.est_featured === 'TRUE') {
                        await this.callWebApp('updateRecommandation', {
                            id: reco.id,
                            est_featured: 'FALSE'
                        });
                    }
                }
                this.selectionMode = 'auto';
                this.featuredRecoId = this.recos[0]?.id || null;
                // Vider le cache pour que les modifications soient visibles immédiatement
                SheetsAPI.clearCache();
            } else {
                // Mode manuel
                await this.setFeatured(selected.value);
            }

            await this.loadData();
            this.renderFeaturedReco();
            this.renderRecosList();
            this.closeSelectModal();

        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur: ' + error.message);
        } finally {
            applyBtn.disabled = false;
            applyBtn.textContent = '✓ Appliquer';
        }
    },

    /**
     * Ouvre une URL dans un nouvel onglet
     */
    openUrl(url) {
        if (url) {
            window.open(url, '_blank');
        }
    },

    /**
     * Appelle le Web App Google Apps Script
     */
    async callWebApp(action, data) {
        return new Promise((resolve, reject) => {
            const callbackName = 'callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

            window[callbackName] = (response) => {
                delete window[callbackName];
                document.body.removeChild(script);

                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Erreur inconnue'));
                }
            };

            const params = new URLSearchParams({
                action: action,
                callback: callbackName,
                data: JSON.stringify(data)
            });

            const script = document.createElement('script');
            script.src = `${CONFIG.WEBAPP_URL}?${params.toString()}`;
            script.onerror = () => {
                delete window[callbackName];
                document.body.removeChild(script);
                reject(new Error('Erreur réseau'));
            };

            document.body.appendChild(script);
        });
    },

    /**
     * Formate une date
     */
    formatDate(dateStr) {
        if (!dateStr) return 'Date inconnue';
        const date = new Date(dateStr);
        if (isNaN(date)) return dateStr;
        return date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    },

    /**
     * Capitalise la première lettre
     */
    capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    /**
     * Convertit les URLs de partage en URLs directes pour les images
     */
    getDirectImageUrl(url) {
        if (!url) return null;

        // Google Drive: https://drive.google.com/file/d/FILE_ID/view
        const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (driveMatch) {
            // Utilise lh3.googleusercontent.com qui est plus fiable
            return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
        }

        // Google Drive: https://drive.google.com/open?id=FILE_ID
        const driveMatch2 = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
        if (driveMatch2) {
            return `https://lh3.googleusercontent.com/d/${driveMatch2[1]}`;
        }

        // Google Drive: uc?id=FILE_ID ou uc?export=view&id=FILE_ID
        const driveMatch3 = url.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/);
        if (driveMatch3) {
            return `https://lh3.googleusercontent.com/d/${driveMatch3[1]}`;
        }

        // Dropbox: remplacer dl=0 par dl=1
        if (url.includes('dropbox.com')) {
            return url.replace('dl=0', 'dl=1');
        }

        // URL déjà directe
        return url;
    }
};

// Export global
window.AdminRecommandations = AdminRecommandations;
