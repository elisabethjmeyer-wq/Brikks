/**
 * Admin Vidéos - Gestion des vidéos de la semaine
 */

const AdminVideos = {
    // Données
    videos: [],
    featuredVideoId: null,
    displayEnabled: true,
    selectionMode: 'auto', // 'auto' ou 'manual'

    // État d'édition
    editingVideoId: null,
    deletingVideoId: null,

    /**
     * Initialise la page
     */
    async init() {
        try {
            await this.loadData();
            this.renderFeaturedVideo();
            this.renderVideosList();
            this.renderMonthFilter();
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
        const videos = await SheetsAPI.fetchAndParse(CONFIG.SHEETS.VIDEOS);

        // Filtrer les vidéos sans ID valide et trier par date
        this.videos = (videos || [])
            .filter(v => {
                if (!v.id || v.id.trim() === '') {
                    console.warn('Vidéo ignorée car sans ID:', v);
                    return false;
                }
                return true;
            })
            .sort((a, b) => {
                const dateA = new Date(a.date_publication || 0);
                const dateB = new Date(b.date_publication || 0);
                return dateB - dateA;
            });

        // Déterminer la vidéo mise en avant
        const featured = this.videos.find(v => v.est_featured === 'TRUE' || v.est_featured === true);
        if (featured) {
            this.featuredVideoId = featured.id;
            this.selectionMode = 'manual';
        } else if (this.videos.length > 0) {
            // Par défaut, la plus récente
            this.featuredVideoId = this.videos[0].id;
            this.selectionMode = 'auto';
        }

    },

    /**
     * Affiche le contenu principal
     */
    showContent() {
        const loader = document.getElementById('loader');
        const content = document.getElementById('videos-content');
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
     * Affiche la vidéo mise en avant
     */
    renderFeaturedVideo() {
        const section = document.getElementById('currentVideoSection');
        const noVideoState = document.getElementById('noVideoState');
        const content = document.getElementById('currentVideoContent');
        const message = document.getElementById('currentVideoMessage');
        const modeBadge = document.getElementById('modeBadge');

        if (this.videos.length === 0) {
            if (section) section.style.display = 'none';
            if (noVideoState) noVideoState.style.display = 'block';
            return;
        }

        if (section) section.style.display = 'block';
        if (noVideoState) noVideoState.style.display = 'none';

        // Mettre à jour le badge mode
        if (modeBadge) {
            modeBadge.textContent = this.selectionMode === 'auto' ? 'AUTO' : 'MANUEL';
            modeBadge.className = this.selectionMode === 'auto' ? 'auto-badge' : 'manual-badge';
        }

        const featuredVideo = this.videos.find(v => v.id === this.featuredVideoId) || this.videos[0];

        if (content && featuredVideo) {
            content.innerHTML = `
                <div class="current-video-thumb">
                    <div class="play-icon">▶</div>
                </div>
                <div class="current-video-info">
                    <div class="current-video-title">${escapeHtml(featuredVideo.titre)}</div>
                    <div class="current-video-date">Ajoutée le ${this.formatDate(featuredVideo.date_publication)}</div>
                </div>
                <div class="current-video-actions">
                    <button class="btn btn-outline btn-sm" onclick="AdminVideos.openSelectModal()">
                        🔄 Changer
                    </button>
                    <button class="btn btn-ghost btn-sm" onclick="AdminVideos.viewVideo('${featuredVideo.id}')" title="Voir la vidéo">
                        👁️
                    </button>
                </div>
            `;
        }

        // Message joint
        if (message && featuredVideo) {
            if (featuredVideo.description && featuredVideo.description.trim()) {
                message.style.display = 'block';
                document.getElementById('messageContent').innerHTML = this.formatDescription(featuredVideo.description);
            } else {
                message.style.display = 'none';
            }
        }
    },

    /**
     * Affiche la liste des vidéos
     */
    renderVideosList() {
        const list = document.getElementById('videosList');
        const emptyState = document.getElementById('emptyState');
        const count = document.getElementById('videosCount');

        if (count) {
            count.textContent = `${this.videos.length} vidéo${this.videos.length > 1 ? 's' : ''}`;
        }

        if (this.videos.length === 0) {
            if (list) list.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (list) list.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';

        const filteredVideos = this.getFilteredVideos();

        if (list) {
            list.innerHTML = filteredVideos.map(video => {
                const isFeatured = video.id === this.featuredVideoId;
                const hasMessage = video.description && video.description.trim();

                return `
                    <div class="video-item ${isFeatured ? 'featured' : ''}" data-id="${video.id}">
                        <span class="video-drag">⋮⋮</span>
                        <div class="video-thumb">
                            <div class="play">▶</div>
                        </div>
                        <div class="video-info">
                            <div class="video-title">
                                ${isFeatured ? '<span class="star">⭐</span>' : ''}
                                ${escapeHtml(video.titre)}
                                ${hasMessage ? '<span class="video-has-message">📝 Message</span>' : ''}
                            </div>
                            <div class="video-meta">
                                <span>${this.formatDate(video.date_publication)}</span>
                                ${video.tags ? `<span>•</span><span>${escapeHtml(video.tags)}</span>` : ''}
                            </div>
                        </div>
                        <div class="video-actions">
                            ${!isFeatured ? `<button class="action-btn star" onclick="AdminVideos.setFeatured('${video.id}')" title="Mettre en avant">⭐</button>` : ''}
                            <button class="action-btn" onclick="AdminVideos.viewVideo('${video.id}')" title="Voir">👁️</button>
                            <button class="action-btn" onclick="AdminVideos.editVideo('${video.id}')" title="Modifier">✏️</button>
                            <button class="action-btn danger" onclick="AdminVideos.confirmDelete('${video.id}')" title="Supprimer">🗑️</button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    },

    /**
     * Affiche le filtre de mois
     */
    renderMonthFilter() {
        const select = document.getElementById('filterMonth');
        if (!select) return;

        // Extraire les mois uniques des vidéos
        const months = new Set();
        this.videos.forEach(v => {
            if (v.date_publication) {
                const date = new Date(v.date_publication);
                if (!isNaN(date)) {
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    months.add(monthKey);
                }
            }
        });

        const sortedMonths = Array.from(months).sort().reverse();

        select.innerHTML = '<option value="all">Tous les mois</option>';
        sortedMonths.forEach(m => {
            const [year, month] = m.split('-');
            const monthName = new Date(year, parseInt(month) - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            select.innerHTML += `<option value="${m}">${monthName}</option>`;
        });
    },

    /**
     * Récupère les vidéos filtrées
     */
    getFilteredVideos() {
        const searchInput = document.getElementById('searchInput');
        const filterMonth = document.getElementById('filterMonth');

        const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const month = filterMonth ? filterMonth.value : 'all';

        return this.videos.filter(video => {
            // Filtre recherche
            if (search && !video.titre.toLowerCase().includes(search)) {
                return false;
            }

            // Filtre mois
            if (month !== 'all' && video.date_publication) {
                const date = new Date(video.date_publication);
                const videoMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                if (videoMonth !== month) {
                    return false;
                }
            }

            return true;
        });
    },

    /**
     * Lie les événements
     */
    bindEvents() {
        // Bouton nouvelle vidéo
        document.getElementById('addVideoBtn')?.addEventListener('click', () => this.openAddModal());

        // Toggle affichage
        document.getElementById('toggleDisplay')?.addEventListener('click', () => this.toggleDisplay());

        // Recherche et filtres
        document.getElementById('searchInput')?.addEventListener('input', () => this.renderVideosList());
        document.getElementById('filterMonth')?.addEventListener('change', () => this.renderVideosList());

        // Modal vidéo
        document.getElementById('closeVideoModal')?.addEventListener('click', () => this.closeVideoModal());
        document.getElementById('cancelVideoBtn')?.addEventListener('click', () => this.closeVideoModal());
        document.getElementById('saveVideoBtn')?.addEventListener('click', () => this.saveVideo());

        // Prévisualisation URL
        document.getElementById('videoUrl')?.addEventListener('input', (e) => this.updatePreview(e.target.value));

        // Modal sélection
        document.getElementById('closeSelectModal')?.addEventListener('click', () => this.closeSelectModal());
        document.getElementById('cancelSelectBtn')?.addEventListener('click', () => this.closeSelectModal());
        document.getElementById('applySelectBtn')?.addEventListener('click', () => this.applySelection());

        // Modal suppression
        document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => this.deleteVideo());

        // Modal voir vidéo
        document.getElementById('closeViewModal')?.addEventListener('click', () => this.closeViewModal());

        // Fermer modals au clic sur overlay
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.add('hidden');
                }
            });
        });

        // Éditeur de texte enrichi
        this.initRichTextEditor();
    },

    /**
     * Initialise l'éditeur de texte enrichi
     */
    initRichTextEditor() {
        // Boutons de la barre d'outils
        document.querySelectorAll('.editor-btn[data-cmd]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const cmd = btn.dataset.cmd;
                document.execCommand(cmd, false, null);
                document.getElementById('videoDescription')?.focus();
            });
        });

        // Sélecteur de couleur
        document.getElementById('textColor')?.addEventListener('change', (e) => {
            if (e.target.value) {
                document.execCommand('foreColor', false, e.target.value);
                e.target.value = ''; // Reset
                document.getElementById('videoDescription')?.focus();
            }
        });
    },

    /**
     * Toggle l'affichage sur la page d'accueil
     */
    toggleDisplay() {
        const toggle = document.getElementById('toggleDisplay');
        toggle.classList.toggle('active');
        this.displayEnabled = toggle.classList.contains('active');
        // Ici on pourrait sauvegarder ce paramètre
    },

    /**
     * Ouvre le modal d'ajout
     */
    openAddModal() {
        this.editingVideoId = null;
        document.getElementById('modalTitle').textContent = '🎬 Nouvelle vidéo';
        document.getElementById('videoId').value = '';
        document.getElementById('videoTitre').value = '';
        document.getElementById('videoUrl').value = '';
        document.getElementById('videoDescription').innerHTML = '';
        document.getElementById('videoDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('videoTags').value = '';

        this.updatePreview('');
        document.getElementById('videoModal').classList.remove('hidden');
    },

    /**
     * Ouvre le modal d'édition
     */
    editVideo(videoId) {
        const video = this.videos.find(v => v.id === videoId);
        if (!video) return;

        this.editingVideoId = videoId;
        document.getElementById('modalTitle').textContent = '✏️ Modifier la vidéo';
        document.getElementById('videoId').value = video.id;
        document.getElementById('videoTitre').value = video.titre || '';
        document.getElementById('videoUrl').value = video.url || '';
        // Support pour HTML enrichi ou texte simple
        const descEl = document.getElementById('videoDescription');
        if (video.description_html) {
            descEl.innerHTML = video.description_html;
        } else {
            descEl.innerHTML = this.textToHtml(video.description || '');
        }
        document.getElementById('videoDate').value = video.date_publication || '';
        document.getElementById('videoTags').value = video.tags || '';

        this.updatePreview(video.url || '');
        document.getElementById('videoModal').classList.remove('hidden');
    },

    /**
     * Convertit du texte simple en HTML (pour la rétrocompatibilité)
     */
    textToHtml(text) {
        if (!text) return '';
        return escapeHtml(text).replace(/\n/g, '<br>');
    },

    /**
     * Ferme le modal vidéo
     */
    closeVideoModal() {
        document.getElementById('videoModal').classList.add('hidden');
        this.editingVideoId = null;
    },

    /**
     * Met à jour la prévisualisation vidéo
     */
    updatePreview(url) {
        const preview = document.getElementById('videoPreview');
        if (!preview) return;

        const embedUrl = this.getEmbedUrl(url);

        if (embedUrl) {
            preview.classList.add('has-video');
            preview.innerHTML = `<iframe src="${embedUrl}" allowfullscreen></iframe>`;
        } else {
            preview.classList.remove('has-video');
            preview.innerHTML = '<span>Aperçu vidéo</span>';
        }
    },

    /**
     * Convertit une URL en URL embed
     */
    getEmbedUrl(url) {
        if (!url) return null;

        // Loom
        if (url.includes('loom.com/share/')) {
            return url.replace('/share/', '/embed/');
        }

        // YouTube
        const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
        if (ytMatch) {
            return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;
        }

        // Vimeo
        const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
        if (vimeoMatch) {
            return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
        }

        // URL embed directe
        if (url.includes('/embed/') || url.includes('player.')) {
            return url;
        }

        return null;
    },

    /**
     * Sauvegarde une vidéo
     */
    async saveVideo() {
        const titre = document.getElementById('videoTitre').value.trim();
        const url = document.getElementById('videoUrl').value.trim();
        const descEl = document.getElementById('videoDescription');
        const descriptionHtml = descEl.innerHTML.trim();
        // Extraire le texte brut pour compatibilité
        const description = descEl.innerText.trim();
        const date = document.getElementById('videoDate').value;
        const tags = document.getElementById('videoTags').value.trim();

        if (!titre || !url) {
            alert('Le titre et l\'URL sont obligatoires.');
            return;
        }

        const saveBtn = document.getElementById('saveVideoBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Enregistrement...';

        try {
            const videoData = {
                titre,
                url,
                description,
                description_html: descriptionHtml,
                date_publication: date,
                tags,
                est_featured: 'FALSE'
            };

            if (this.editingVideoId) {
                // Mise à jour
                videoData.id = this.editingVideoId;
                await this.callWebApp('updateVideo', videoData);
            } else {
                // Création
                await this.callWebApp('createVideo', videoData);
            }

            // Vider le cache pour que les modifications soient visibles immédiatement
            SheetsAPI.clearCache();

            // Recharger les données
            await this.loadData();
            this.renderFeaturedVideo();
            this.renderVideosList();
            this.renderMonthFilter();
            this.closeVideoModal();

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
    confirmDelete(videoId) {
        if (!videoId || videoId === 'undefined' || videoId === 'null') {
            console.error('ID vidéo invalide:', videoId);
            alert('Erreur: ID de la vidéo invalide');
            return;
        }

        const video = this.videos.find(v => v.id === videoId);
        if (!video) {
            console.error('Vidéo non trouvée pour ID:', videoId);
            return;
        }

        this.deletingVideoId = videoId;

        document.getElementById('deleteConfirmText').textContent =
            `Voulez-vous vraiment supprimer "${video.titre}" ?`;
        document.getElementById('deleteModal').classList.remove('hidden');
    },

    /**
     * Ferme le modal de suppression
     */
    closeDeleteModal() {
        document.getElementById('deleteModal').classList.add('hidden');
        this.deletingVideoId = null;
    },

    /**
     * Supprime une vidéo
     */
    async deleteVideo() {
        if (!this.deletingVideoId || this.deletingVideoId === 'undefined') {
            console.error('deletingVideoId invalide:', this.deletingVideoId);
            alert('Erreur: Aucune vidéo sélectionnée pour suppression');
            return;
        }

        const deleteBtn = document.getElementById('confirmDeleteBtn');
        deleteBtn.disabled = true;
        deleteBtn.textContent = 'Suppression...';

        try {
            await this.callWebApp('deleteVideo', { id: this.deletingVideoId });

            // Vider le cache pour que les modifications soient visibles immédiatement
            SheetsAPI.clearCache();

            // Recharger les données
            await this.loadData();
            this.renderFeaturedVideo();
            this.renderVideosList();
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
     * Définit une vidéo comme mise en avant
     */
    async setFeatured(videoId) {
        try {
            // Retirer le featured de l'ancienne vidéo
            if (this.featuredVideoId) {
                await this.callWebApp('updateVideo', {
                    id: this.featuredVideoId,
                    est_featured: 'FALSE'
                });
            }

            // Mettre le featured sur la nouvelle
            await this.callWebApp('updateVideo', {
                id: videoId,
                est_featured: 'TRUE'
            });

            // Vider le cache pour que les modifications soient visibles immédiatement
            SheetsAPI.clearCache();

            this.featuredVideoId = videoId;
            this.selectionMode = 'manual';

            // Recharger
            await this.loadData();
            this.renderFeaturedVideo();
            this.renderVideosList();

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
        const autoRadio = document.querySelector('input[name="videoMode"][value="auto"]');
        if (autoRadio) autoRadio.checked = (this.selectionMode === 'auto');

        // Générer la liste
        if (selectList) {
            selectList.innerHTML = this.videos.map(video => `
                <label class="select-item">
                    <input type="radio" name="videoMode" value="${video.id}"
                           ${this.selectionMode === 'manual' && this.featuredVideoId === video.id ? 'checked' : ''}>
                    <div class="select-item-info">
                        <div class="select-item-title">${escapeHtml(video.titre)}</div>
                        <div class="select-item-date">${this.formatDate(video.date_publication)}</div>
                    </div>
                </label>
            `).join('');
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
        const selected = document.querySelector('input[name="videoMode"]:checked');
        if (!selected) return;

        const applyBtn = document.getElementById('applySelectBtn');
        applyBtn.disabled = true;
        applyBtn.textContent = 'Application...';

        try {
            if (selected.value === 'auto') {
                // Mode auto : retirer tous les featured
                for (const video of this.videos) {
                    if (video.est_featured === 'TRUE') {
                        await this.callWebApp('updateVideo', {
                            id: video.id,
                            est_featured: 'FALSE'
                        });
                    }
                }
                this.selectionMode = 'auto';
                this.featuredVideoId = this.videos[0]?.id || null;
                // Vider le cache pour que les modifications soient visibles immédiatement
                SheetsAPI.clearCache();
            } else {
                // Mode manuel
                await this.setFeatured(selected.value);
            }

            await this.loadData();
            this.renderFeaturedVideo();
            this.renderVideosList();
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
     * Ouvre le modal de visualisation
     */
    viewVideo(videoId) {
        const video = this.videos.find(v => v.id === videoId);
        if (!video) return;

        const embedUrl = this.getEmbedUrl(video.url);

        document.getElementById('viewModalTitle').textContent = video.titre;
        document.getElementById('viewVideoContainer').innerHTML = embedUrl
            ? `<iframe src="${embedUrl}" allowfullscreen></iframe>`
            : '<div style="color: white; padding: 40px; text-align: center;">Impossible de charger la vidéo</div>';

        document.getElementById('viewModal').classList.remove('hidden');
    },

    /**
     * Ferme le modal de visualisation
     */
    closeViewModal() {
        document.getElementById('viewModal').classList.add('hidden');
        document.getElementById('viewVideoContainer').innerHTML = '';
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
     * Formate la description (convertit les bullets)
     */
    formatDescription(text) {
        if (!text) return '';
        return escapeHtml(text)
            .replace(/\n/g, '<br>')
            .replace(/^•/gm, '•');
    }
};

// Export global
window.AdminVideos = AdminVideos;
