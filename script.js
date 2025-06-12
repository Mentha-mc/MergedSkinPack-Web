class SkinPackMerger {
    constructor() {
        this.loadedSkinPacks = [];
        this.mergedResult = null;
        this.isProcessing = false;
        
        this.initializeEventListeners();
        this.setupDragAndDrop();
    }

    initializeEventListeners() {
        const folderInput = document.getElementById('folderInput');
        const fileInput = document.getElementById('fileInput');
        
        folderInput.addEventListener('change', (e) => this.handleFolderSelection(e));
        fileInput.addEventListener('change', (e) => this.handleFileSelection(e));
        
        // Help button
        document.getElementById('helpBtn').addEventListener('click', () => this.showHelp());
    }

    setupDragAndDrop() {
        const uploadZone = document.getElementById('uploadZone');
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadZone.addEventListener(eventName, this.preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadZone.addEventListener(eventName, () => this.highlight(uploadZone), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadZone.addEventListener(eventName, () => this.unhighlight(uploadZone), false);
        });

        uploadZone.addEventListener('drop', (e) => this.handleDrop(e), false);
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    highlight(element) {
        element.classList.add('drag-over');
    }

    unhighlight(element) {
        element.classList.remove('drag-over');
    }

    handleDrop(e) {
        const files = Array.from(e.dataTransfer.files);
        
        if (files.length > 0 && files[0].webkitRelativePath) {
            this.processSkinPackFolders(files);
        } else {
            const jsonFiles = files.filter(file => file.name.endsWith('.json'));
            if (jsonFiles.length > 0) {
                jsonFiles.forEach(file => this.loadSingleFile(file));
            } else {
                this.showToast('请拖拽包含皮肤包的文件夹', 'warning');
            }
        }
    }

    handleFolderSelection(e) {
        const files = Array.from(e.target.files);
        this.processSkinPackFolders(files);
    }

    handleFileSelection(e) {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            if (file.name.endsWith('.json')) {
                this.loadSingleFile(file);
            }
        });
    }

    processSkinPackFolders(files) {
        if (files.length === 0) return;
        
        this.showToast('开始处理文件夹...', 'info');
        const folderGroups = this.groupFilesByFolder(files);
        
        this.logMessage(`发现 ${Object.keys(folderGroups).length} 个文件夹`, 'info');

        Object.entries(folderGroups).forEach(([folderName, folderContent]) => {
            if (folderContent.skins.length > 0) {
                this.loadSkinPackFolder(folderName, folderContent);
            } else {
                this.logMessage(`警告: ${folderName} 中没有 skins.json 文件`, 'warning');
            }
        });
    }

    groupFilesByFolder(files) {
        const folderGroups = {};
        
        files.forEach(file => {
            const pathParts = file.webkitRelativePath.split('/');
            const folderName = pathParts[0];
            
            if (!folderGroups[folderName]) {
                folderGroups[folderName] = {
                    skins: [],
                    geometries: [],
                    textures: [],
                    others: []
                };
            }
            
            const fileName = file.name.toLowerCase();
            if (fileName === 'skins.json') {
                folderGroups[folderName].skins.push(file);
            } else if (fileName.endsWith('.json') && (fileName.includes('geometry') || fileName.includes('model'))) {
                folderGroups[folderName].geometries.push(file);
            } else if (fileName.match(/\.(png|jpg|jpeg)$/)) {
                folderGroups[folderName].textures.push(file);
            } else {
                folderGroups[folderName].others.push(file);
            }
        });

        return folderGroups;
    }

    async loadSkinPackFolder(folderName, folderContent) {
        try {
            this.logMessage(`处理文件夹: ${folderName}`, 'info');
            
            const skinFile = folderContent.skins[0];
            const skinData = await this.readJsonFile(skinFile);
            const geometryData = await this.processGeometryFiles(folderContent.geometries);
            const packInfo = this.analyzeSkinPack(skinData, folderContent);
            
            const skinPack = {
                folderName,
                skinData,
                geometryData,
                textureFiles: folderContent.textures,
                otherFiles: folderContent.others,
                info: packInfo
            };
            
            this.loadedSkinPacks.push(skinPack);
            this.addSkinPackToList(skinPack);
            this.updateUI();
            
            this.logMessage(`成功加载: ${folderName}`, 'success');
            this.showToast(`已加载 ${folderName}`, 'success');
            
        } catch (error) {
            this.logMessage(`加载失败: ${folderName} - ${error.message}`, 'error');
            this.showToast(`加载失败: ${folderName}`, 'error');
        }
    }

    async readJsonFile(file) {
        const content = await this.readFileAsText(file);
        try {
            return JSON.parse(content);
        } catch (firstError) {
            this.logMessage(`清理 JSON 注释: ${file.name}`, 'warning');
            const cleanedContent = this.cleanJsonComments(content);
            return JSON.parse(cleanedContent);
        }
    }

    cleanJsonComments(jsonString) {
        let cleaned = jsonString.replace(/\/\/.*$/gm, '');
        cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
        cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
        return cleaned;
    }

    async processGeometryFiles(geometryFiles) {
        const geometryData = [];
        
        for (const file of geometryFiles) {
            try {
                const content = await this.readFileAsText(file);
                const data = JSON.parse(content);
                geometryData.push({
                    fileName: file.name,
                    data: data
                });
            } catch (error) {
                this.logMessage(`几何模型读取失败: ${file.name}`, 'warning');
            }
        }
        
        return geometryData;
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    analyzeSkinPack(skinData, folderContent) {
        const info = {
            serializeName: skinData.serialize_name || '未知',
            localizationName: skinData.localization_name || '未知',
            skinCount: (skinData.skins || []).length,
            geometryCount: folderContent.geometries.length,
            textureCount: folderContent.textures.length,
            otherCount: folderContent.others.length,
            geometries: new Set(),
            textures: new Set()
        };

        (skinData.skins || []).forEach(skin => {
            if (skin.geometry) info.geometries.add(skin.geometry);
            if (skin.texture) info.textures.add(skin.texture);
        });

        info.geometries = Array.from(info.geometries);
        info.textures = Array.from(info.textures);

        return info;
    }

    addSkinPackToList(skinPack) {
        const fileList = document.getElementById('fileList');
        const fileListSection = document.getElementById('fileListSection');
        
        // Show the file list section if it's hidden
        fileListSection.style.display = 'block';
        
        const fileCard = document.createElement('div');
        fileCard.className = 'file-card';
        fileCard.dataset.folder = skinPack.folderName;
        
        fileCard.innerHTML = `
            <div class="file-header">
                <div class="file-name">
                    <i class="fas fa-folder"></i>
                    ${skinPack.folderName}
                </div>
                <button class="remove-btn" onclick="skinPackMerger.removeSkinPack('${skinPack.folderName}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="file-stats">
                <div class="file-stat">
                    <div class="file-stat-value">${skinPack.info.skinCount}</div>
                    <div class="file-stat-label">皮肤</div>
                </div>
                <div class="file-stat">
                    <div class="file-stat-value">${skinPack.info.geometryCount}</div>
                    <div class="file-stat-label">模型</div>
                </div>
                <div class="file-stat">
                    <div class="file-stat-value">${skinPack.info.textureCount}</div>
                    <div class="file-stat-label">纹理</div>
                </div>
                <div class="file-stat">
                    <div class="file-stat-value">${skinPack.info.otherCount}</div>
                    <div class="file-stat-label">其他</div>
                </div>
            </div>
            
            <div class="file-details">
                <div class="file-category">
                    <div class="file-category-title">
                        <i class="fas fa-cog"></i>
                        配置信息
                    </div>
                    <div class="file-category-items">
                        <div class="file-category-item">${skinPack.info.serializeName}</div>
                    </div>
                </div>
                
                ${skinPack.geometryData.length > 0 ? `
                <div class="file-category">
                    <div class="file-category-title">
                        <i class="fas fa-shapes"></i>
                        几何模型
                    </div>
                    <div class="file-category-items">
                        ${skinPack.geometryData.map(geo => 
                            `<div class="file-category-item">${geo.fileName}</div>`
                        ).join('')}
                    </div>
                </div>
                ` : ''}
                
                ${skinPack.textureFiles.length > 0 ? `
                <div class="file-category">
                    <div class="file-category-title">
                        <i class="fas fa-image"></i>
                        纹理文件 ${skinPack.textureFiles.length > 5 ? `(显示前5个)` : ''}
                    </div>
                    <div class="file-category-items">
                        ${skinPack.textureFiles.slice(0, 5).map(tex => 
                            `<div class="file-category-item">${tex.name}</div>`
                        ).join('')}
                        ${skinPack.textureFiles.length > 5 ? 
                            `<div class="file-category-item">+${skinPack.textureFiles.length - 5} 更多...</div>` : ''
                        }
                    </div>
                </div>
                ` : ''}
            </div>
        `;
        
        fileList.appendChild(fileCard);
        
        // Animate the new card
        setTimeout(() => {
            fileCard.style.opacity = '0';
            fileCard.style.transform = 'translateY(20px)';
            fileCard.style.transition = 'all 0.3s ease';
            
            requestAnimationFrame(() => {
                fileCard.style.opacity = '1';
                fileCard.style.transform = 'translateY(0)';
            });
        }, 10);
    }

    removeSkinPack(folderName) {
        this.loadedSkinPacks = this.loadedSkinPacks.filter(pack => pack.folderName !== folderName);
        
        const fileCard = document.querySelector(`[data-folder="${folderName}"]`);
        if (fileCard) {
            fileCard.style.transition = 'all 0.3s ease';
            fileCard.style.opacity = '0';
            fileCard.style.transform = 'translateX(-100%)';
            
            setTimeout(() => {
                fileCard.remove();
                this.updateUI();
            }, 300);
        }
        
        this.logMessage(`移除: ${folderName}`, 'warning');
        this.showToast(`已移除 ${folderName}`, 'warning');
    }

    updateUI() {
        const mergeBtn = document.getElementById('mergeBtn');
        const fileCount = document.getElementById('fileCount');
        const fileListSection = document.getElementById('fileListSection');
        
        mergeBtn.disabled = this.loadedSkinPacks.length === 0;
        
        if (fileCount) {
            fileCount.textContent = this.loadedSkinPacks.length;
        }
        
        if (this.loadedSkinPacks.length === 0) {
            fileListSection.style.display = 'none';
        }
    }

    async mergeSkinPacks() {
        if (this.loadedSkinPacks.length === 0) {
            this.showToast('请先选择要合并的皮肤包', 'error');
            return;
        }

        if (this.isProcessing) {
            this.showToast('正在处理中，请稍候...', 'warning');
            return;
        }

        this.isProcessing = true;
        this.showProgress(true);
        this.updateProgress(0, '开始合并...');
        this.logMessage('开始合并皮肤包...', 'info');

        try {
            const merger = new CompleteSkinPackMerger();
            this.mergedResult = await merger.merge(this.loadedSkinPacks, (progress, message) => {
                this.updateProgress(progress, message);
            });
            
            if (this.mergedResult) {
                this.logMessage('合并完成！', 'success');
                this.showToast('合并完成！', 'success');
                this.updateResultStats();
                this.showDownloadButton();
            } else {
                throw new Error('合并结果为空');
            }
        } catch (error) {
            this.logMessage(`合并错误: ${error.message}`, 'error');
            this.showToast(`合并失败: ${error.message}`, 'error');
            console.error('合并过程错误:', error);
        } finally {
            this.isProcessing = false;
            setTimeout(() => this.showProgress(false), 1000);
        }
    }

    showDownloadButton() {
        const mergeBtn = document.getElementById('mergeBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        
        mergeBtn.style.display = 'none';
        downloadBtn.style.display = 'inline-flex';
        downloadBtn.disabled = false;
    }

    updateResultStats() {
        if (!this.mergedResult) return;

        document.getElementById('totalSkins').textContent = this.mergedResult.stats.totalSkins;
        document.getElementById('totalGeometries').textContent = this.mergedResult.stats.totalGeometries;
        document.getElementById('totalTextures').textContent = this.mergedResult.stats.textureCount;
        document.getElementById('totalFolders').textContent = this.mergedResult.stats.folderCount;
        
        document.getElementById('resultsSection').style.display = 'block';
        
        // Animate stats
        this.animateStats();
    }

    animateStats() {
        const statValues = document.querySelectorAll('.stat-value');
        statValues.forEach(stat => {
            const target = parseInt(stat.textContent);
            let current = 0;
            const increment = target / 30;
            
            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    current = target;
                    clearInterval(timer);
                }
                stat.textContent = Math.floor(current);
            }, 50);
        });
    }

    showProgress(show) {
        const progressSection = document.getElementById('progressSection');
        if (show) {
            progressSection.style.display = 'block';
        } else {
            progressSection.style.display = 'none';
        }
    }

    updateProgress(percent, message = '') {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        progressFill.style.width = percent + '%';
        if (message) {
            progressText.textContent = message;
        }
    }

    async downloadResult() {
        if (!this.mergedResult) {
            this.showToast('没有可下载的结果', 'error');
            return;
        }

        const downloadType = document.querySelector('input[name="downloadType"]:checked').value;
        
        this.showProgress(true);
        this.updateProgress(0, '准备下载...');
        
        try {
            if (downloadType === 'zip') {
                await this.downloadAsZip();
            } else {
                this.downloadSeparateFiles();
            }
            this.showToast('下载完成', 'success');
        } catch (error) {
            this.logMessage(`下载失败: ${error.message}`, 'error');
            this.showToast('下载失败', 'error');
        } finally {
            setTimeout(() => this.showProgress(false), 1000);
        }
    }

    async downloadAsZip() {
        const zip = new JSZip();
        const packageName = this.mergedResult.skins.serialize_name;
        
        this.updateProgress(10, '生成 ZIP 文件...');
        this.logMessage('生成 ZIP 文件...', 'info');
        
        // Add JSON files
        zip.file('skins.json', JSON.stringify(this.mergedResult.skins, null, 2));
        if (this.mergedResult.geometry['minecraft:geometry'].length > 0) {
            zip.file('geometry.json', JSON.stringify(this.mergedResult.geometry, null, 2));
        }
        
        this.updateProgress(20, '添加纹理文件...');
        
        // Add texture files
        if (this.mergedResult.textures.size > 0) {
            const textureFiles = Array.from(this.mergedResult.textures);
            for (let i = 0; i < textureFiles.length; i++) {
                const [fileName, file] = textureFiles[i];
                try {
                    const fileContent = await this.readFileAsArrayBuffer(file);
                    zip.file(fileName, fileContent);
                    
                    const progress = 20 + (i / textureFiles.length) * 50;
                    this.updateProgress(progress, `处理纹理: ${i + 1}/${textureFiles.length}`);
                    
                    if (i % 10 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 10));
                    }
                } catch (error) {
                    this.logMessage(`纹理处理失败: ${fileName}`, 'warning');
                }
            }
        }
        
        this.updateProgress(70, '添加其他文件...');
        
        // Add other files
        if (this.mergedResult.others.size > 0) {
            const otherFiles = Array.from(this.mergedResult.others);
            for (let i = 0; i < otherFiles.length; i++) {
                const [fileName, file] = otherFiles[i];
                try {
                    const fileContent = await this.readFileAsArrayBuffer(file);
                    zip.file(fileName, fileContent);
                } catch (error) {
                    this.logMessage(`其他文件处理失败: ${fileName}`, 'warning');
                }
            }
        }
        
        this.updateProgress(85, '压缩文件...');
        
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        }, (metadata) => {
            const progress = 85 + (metadata.percent * 0.1);
            this.updateProgress(progress, `压缩: ${Math.round(metadata.percent)}%`);
        });
        
        this.updateProgress(95, '开始下载...');
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = `${packageName}_merged.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.updateProgress(100, '下载完成');
        this.logMessage(`ZIP 下载完成，大小: ${(zipBlob.size / (1024 * 1024)).toFixed(2)} MB`, 'success');
    }

    downloadSeparateFiles() {
        const skinsBlob = new Blob([JSON.stringify(this.mergedResult.skins, null, 2)], { type: 'application/json' });
        this.downloadFile(skinsBlob, 'merged_skins.json');
        
        if (this.mergedResult.geometry['minecraft:geometry'].length > 0) {
            const geometryBlob = new Blob([JSON.stringify(this.mergedResult.geometry, null, 2)], { type: 'application/json' });
            this.downloadFile(geometryBlob, 'merged_geometry.json');
        }
        
        this.logMessage('文件下载开始', 'success');
    }

    downloadFile(blob, filename) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            const timeout = setTimeout(() => {
                reader.abort();
                reject(new Error(`文件读取超时: ${file.name}`));
            }, 30000);
            
            reader.onload = e => {
                clearTimeout(timeout);
                resolve(e.target.result);
            };
            
            reader.onerror = e => {
                clearTimeout(timeout);
                reject(new Error(`文件读取失败: ${file.name}`));
            };
            
            reader.readAsArrayBuffer(file);
        });
    }

    logMessage(message, type = 'info') {
        const logContainer = document.getElementById('logContainer');
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        
        const time = new Date().toLocaleTimeString();
        logEntry.innerHTML = `
            <span class="log-time">[${time}]</span>
            <span class="log-message">${message}</span>
        `;
        
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
        
        // Remove old entries if too many
        const entries = logContainer.querySelectorAll('.log-entry');
        if (entries.length > 100) {
            entries[0].remove();
        }
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            info: 'fa-info-circle',
            success: 'fa-check-circle',
            warning: 'fa-exclamation-triangle',
            error: 'fa-times-circle'
        };
        
        toast.innerHTML = `
            <i class="fas ${icons[type]}"></i>
            <span>${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    loadSingleFile(file) {
        this.logMessage(`加载单个文件: ${file.name}`, 'info');
        // Implement single file loading if needed
    }

    showHelp() {
        this.showToast('拖拽包含 skins.json 的文件夹到上传区域即可开始', 'info');
    }
}

// Complete Skin Pack Merger Class
class CompleteSkinPackMerger {
    constructor() {
        const packageName = document.getElementById('packageName').value.trim();
        const displayName = document.getElementById('displayName').value.trim();
        
        this.mergedSkins = {
            skins: [],
            serialize_name: packageName || "MergedSkinPack",
            localization_name: displayName || "合并皮肤包"
        };
        
        this.mergedGeometry = {
            format_version: "1.12.0",
            "minecraft:geometry": []
        };
        
        this.textureFiles = new Map();
        this.otherFiles = new Map();
    }

    async merge(skinPacks, progressCallback) {
        let totalSkins = 0;
        let totalGeometries = 0;
        let existingSkinNames = new Set();
        let existingGeometryIds = new Set();
        let allPackNames = [];

        for (let i = 0; i < skinPacks.length; i++) {
            const pack = skinPacks[i];
            const progress = (i / skinPacks.length) * 80;
            
            if (progressCallback) {
                progressCallback(progress, `处理: ${pack.folderName} (${i + 1}/${skinPacks.length})`);
            }
            
            allPackNames.push(pack.info.serializeName);

            // Process skins
            const skins = pack.skinData.skins || [];
            for (const skin of skins) {
                const skinCopy = JSON.parse(JSON.stringify(skin));
                let skinName = skinCopy.localization_name || 'unknown';
                
                if (existingSkinNames.has(skinName)) {
                    let counter = 2;
                    let newName = `${skinName}_${counter}`;
                    while (existingSkinNames.has(newName)) {
                        counter++;
                        newName = `${skinName}_${counter}`;
                    }
                    skinCopy.localization_name = newName;
                    skinName = newName;
                }
                
                existingSkinNames.add(skinName);
                this.mergedSkins.skins.push(skinCopy);
                totalSkins++;
            }

            // Process geometries
            for (const geoFile of pack.geometryData) {
                const converted = this.convertGeometryToNewFormat(geoFile.data);
                if (converted && converted['minecraft:geometry']) {
                    for (const geometry of converted['minecraft:geometry']) {
                        const geometryCopy = JSON.parse(JSON.stringify(geometry));
                        const originalId = geometryCopy.description.identifier;
                        
                        let identifier = originalId;
                        if (existingGeometryIds.has(identifier)) {
                            let counter = 2;
                            let newId = `${identifier}_${counter}`;
                            while (existingGeometryIds.has(newId)) {
                                counter++;
                                newId = `${identifier}_${counter}`;
                            }
                            geometryCopy.description.identifier = newId;
                            identifier = newId;
                        }
                        
                        existingGeometryIds.add(identifier);
                        this.mergedGeometry['minecraft:geometry'].push(geometryCopy);
                        totalGeometries++;
                    }
                }
            }

            // Collect files
            pack.textureFiles.forEach(file => {
                if (!this.textureFiles.has(file.name)) {
                    this.textureFiles.set(file.name, file);
                }
            });

            pack.otherFiles.forEach(file => {
                if (!this.otherFiles.has(file.name)) {
                    this.otherFiles.set(file.name, file);
                }
            });

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (progressCallback) {
            progressCallback(90, '完成合并...');
        }

        // Update names if not provided
        const packageName = document.getElementById('packageName').value.trim();
        const displayName = document.getElementById('displayName').value.trim();
        
        if (!packageName) {
            this.mergedSkins.serialize_name = allPackNames.join('_');
        }
        if (!displayName) {
            this.mergedSkins.localization_name = allPackNames.join(' + ');
        }

        if (progressCallback) {
            progressCallback(100, '合并完成');
        }
        
        return {
            skins: this.mergedSkins,
            geometry: this.mergedGeometry,
            textures: this.textureFiles,
            others: this.otherFiles,
            stats: {
                totalSkins,
                totalGeometries,
                textureCount: this.textureFiles.size,
                folderCount: skinPacks.length
            }
        };
    }

    convertGeometryToNewFormat(data) {
        if (data['minecraft:geometry']) {
            return data;
        }

        const geometryKeys = Object.keys(data).filter(key => key.startsWith('geometry.'));
        if (geometryKeys.length === 0) return null;

        const newGeometries = [];

        geometryKeys.forEach((geometryKey) => {
            const oldGeometry = data[geometryKey];
            
            const newGeometry = {
                description: {
                    identifier: geometryKey,
                    texture_width: oldGeometry.texturewidth || 16,
                    texture_height: oldGeometry.textureheight || 16,
                    visible_bounds_width: oldGeometry.visible_bounds_width || 2,
                    visible_bounds_height: oldGeometry.visible_bounds_height || 2,
                    visible_bounds_offset: oldGeometry.visible_bounds_offset || [0, 1, 0]
                },
                bones: oldGeometry.bones || []
            };
            
            newGeometries.push(newGeometry);
        });

        return {
            format_version: "1.12.0",
            "minecraft:geometry": newGeometries
        };
    }
}

// Global functions for onclick handlers
function mergeSkinPacks() {
    skinPackMerger.mergeSkinPacks();
}

function downloadResult() {
    skinPackMerger.downloadResult();
}

function clearLog() {
    document.getElementById('logContainer').innerHTML = '';
}

// Initialize the application
let skinPackMerger;

document.addEventListener('DOMContentLoaded', () => {
    skinPackMerger = new SkinPackMerger();
});