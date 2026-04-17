// main.js - 多类型互动叙事游戏引擎（浪漫/悬疑/玄幻）
(function() {
        // 自定义确认框（替代原生 confirm）
    let pendingConfirmCallback = null;

    function showConfirm(message, onOk, onCancel) {
        const overlay = document.getElementById('customConfirm');
        const msgEl = document.getElementById('confirmMessage');
        if (!overlay || !msgEl) return;
        msgEl.innerText = message;
        overlay.classList.add('active');
        
        const okHandler = () => {
            overlay.classList.remove('active');
            if (onOk) onOk();
            cleanup();
        };
        const cancelHandler = () => {
            overlay.classList.remove('active');
            if (onCancel) onCancel();
            cleanup();
        };
        
        function cleanup() {
            const okBtn = document.getElementById('confirmOk');
            const cancelBtn = document.getElementById('confirmCancel');
            if (okBtn) okBtn.removeEventListener('click', okHandler);
            if (cancelBtn) cancelBtn.removeEventListener('click', cancelHandler);
        }
        
        const okBtn = document.getElementById('confirmOk');
        const cancelBtn = document.getElementById('confirmCancel');
        if (okBtn) okBtn.addEventListener('click', okHandler);
        if (cancelBtn) cancelBtn.addEventListener('click', cancelHandler);
    }
    const CONFIG = {
        dataPath: 'data/stories/',
        indexUrl: 'data/storyIndex.json'
    };

    let currentStory = null;
    let currentNodeId = null;
    let currentFlags = {};
    let gameActive = true;
    let currentType = null;
    let currentStoryId = null;

    const storyTitleEl = document.getElementById('storyTitle');
    const storyTextEl = document.getElementById('storyText');
    const optionsArea = document.getElementById('optionsArea');
    const restartBtn = document.getElementById('restartBtn');
    const resetGameBtn = document.getElementById('resetGameBtn');

    function showError(msg) {
        storyTextEl.innerText = `⚠️ 错误：${msg}\n请刷新页面重试。`;
        optionsArea.innerHTML = '<button class="option-btn" onclick="location.reload()">重新加载</button>';
    }

    function saveGame() {
        if (!gameActive || !currentStory) return;
        const save = {
            type: currentType,
            storyId: currentStory.meta.storyId,
            nodeId: currentNodeId,
            flags: currentFlags,
            timestamp: Date.now()
        };
        localStorage.setItem('narrative_save', JSON.stringify(save));
    }

    function clearSave() {
        localStorage.removeItem('narrative_save');
    }

    function resetGameState() {
        if (!currentStory) return;
        currentNodeId = currentStory.startNodeId;
        currentFlags = JSON.parse(JSON.stringify(currentStory.globalFlags || {}));
        gameActive = true;
        clearSave();
        renderCurrentNode();
        saveGame();
    }

    function applyFlags(flagsToSet) {
        if (!flagsToSet) return;
        Object.assign(currentFlags, flagsToSet);
    }

    // 保存当前结局为 TXT 文件
    function saveStoryAsTxt(endingText) {
        if (!currentStory) return;
        const title = currentStory.meta?.title || '互动故事';
        const author = currentStory.meta?.author || '匿名作者';
        const content = `《${title}》\n作者：${author}\n\n${endingText}\n\n—— 故事由你书写，感谢游玩 ——`;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = `${title}_结局.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    function renderCurrentNode() {
        if (!currentStory) return;
        const node = currentStory.nodes[currentNodeId];
        if (!node) {
            showError(`节点 ${currentNodeId} 不存在`);
            return;
        }

        storyTextEl.innerText = node.text;
        storyTextEl.classList.remove('fade-in');
        void storyTextEl.offsetWidth;
        storyTextEl.classList.add('fade-in');

        if (node.isEnding === true) {
            gameActive = false;
            optionsArea.innerHTML = `
                <div style="text-align:center; margin:10px 0;">✨ 故事终章 ✨</div>
                <button class="option-btn" id="playAgainBtn">📖 重新书写结局</button>
                <button class="option-btn" id="newStoryBtn">🌸 换一个故事</button>
                <button class="option-btn" id="changeTypeBtn">🎭 切换类型</button>
                <button class="option-btn" id="saveTxtBtn">💾 保存故事为TXT</button>
            `;
            document.getElementById('playAgainBtn')?.addEventListener('click', () => resetGameState());
            document.getElementById('newStoryBtn')?.addEventListener('click', () => loadRandomStoryByType(currentType));
            document.getElementById('changeTypeBtn')?.addEventListener('click', () => showTypeSelection());
            document.getElementById('saveTxtBtn')?.addEventListener('click', () => saveStoryAsTxt(node.text));
            return;
        }

        if (!node.options || node.options.length === 0) {
            optionsArea.innerHTML = '<button class="option-btn" onclick="location.reload()">重新开始</button>';
            return;
        }

        optionsArea.innerHTML = '';
        node.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerText = opt.text;
            btn.addEventListener('click', () => {
                if (opt.flagsToSet) applyFlags(opt.flagsToSet);
                if (opt.nextNode && currentStory.nodes[opt.nextNode]) {
                    currentNodeId = opt.nextNode;
                    saveGame();
                    renderCurrentNode();
                } else {
                    console.error('无效跳转', opt.nextNode);
                    resetGameState();
                }
            });
            optionsArea.appendChild(btn);
        });
    }

    async function loadStory(type, storyId, fileName) {
        try {
            const url = `${CONFIG.dataPath}${type}/${fileName}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const storyData = await response.json();
            
            if (!storyData.startNodeId || !storyData.nodes) {
                throw new Error('故事文件缺少 startNodeId 或 nodes');
            }
            
            currentStory = storyData;
            currentType = type;
            currentStoryId = storyId;
            currentNodeId = storyData.startNodeId;
            currentFlags = JSON.parse(JSON.stringify(storyData.globalFlags || {}));
            gameActive = true;
            clearSave();
            
            //storyTitleEl.innerText = storyData.meta?.title || '互动故事';
            storyTitleEl.innerText = '您的选择将决定故事的走向';
            renderCurrentNode();
            saveGame();
            enableBottomButtons();
        } catch (err) {
            console.error(err);
            showError(`无法加载故事 ${fileName}：${err.message}`);
        }
    }

    async function loadRandomStoryByType(type) {
        try {
            const indexResp = await fetch(CONFIG.indexUrl);
            if (!indexResp.ok) throw new Error('无法加载故事索引');
            const index = await indexResp.json();
            
            let storyList = index[type];
            if (!storyList || storyList.length === 0) {
                throw new Error(`没有可用的${type}类型故事，请添加后再试。`);
            }
            
            const randomEntry = storyList[Math.floor(Math.random() * storyList.length)];
            await loadStory(type, randomEntry.id, randomEntry.file);
        } catch (err) {
            console.error(err);
            showError(`初始化失败：${err.message}`);
        }
    }

    function showTypeSelection() {
        currentStory = null;
        gameActive = false;
        storyTitleEl.innerText = '选择你的故事类型';
        storyTextEl.innerText = '请选择你喜欢的小说类型，开始你的互动叙事之旅。';
        
        optionsArea.innerHTML = `
            <button class="option-btn type-btn" data-type="romance">🌹 浪漫爱情</button>
            <button class="option-btn type-btn" data-type="mystery">🔍 悬疑推理</button>
            <button class="option-btn type-btn" data-type="fantasy">🐉 玄幻穿越</button>
        `;
        
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.target.dataset.type;
                clearSave();
                loadRandomStoryByType(type);
            });
        });
        
        optionsArea.style.display = 'flex';
        restartBtn.disabled = true;
        resetGameBtn.disabled = true;
        restartBtn.style.opacity = '0.5';
        resetGameBtn.style.opacity = '0.5';
    }

    function enableBottomButtons() {
        restartBtn.disabled = false;
        resetGameBtn.disabled = false;
        restartBtn.style.opacity = '1';
        resetGameBtn.style.opacity = '1';
    }

    async function tryResumeFromSave() {
        const raw = localStorage.getItem('narrative_save');
        if (!raw) return false;
        try {
            const save = JSON.parse(raw);
            const indexResp = await fetch(CONFIG.indexUrl);
            const index = await indexResp.json();
            const storyList = index[save.type];
            if (!storyList) return false;
            const entry = storyList.find(s => s.id === save.storyId);
            if (!entry) return false;
            
            await loadStory(save.type, save.storyId, entry.file);
            if (currentStory && currentStory.nodes[save.nodeId]) {
                currentNodeId = save.nodeId;
                currentFlags = save.flags;
                gameActive = true;
                renderCurrentNode();
                enableBottomButtons();
                return true;
            }
        } catch(e) { console.warn(e); }
        return false;
    }

    function changeToAnotherStory() {
        clearSave();
        showTypeSelection();
    }

    function bindEvents() {
        restartBtn.onclick = () => {
            if (currentStory) {
                showConfirm('重来一次会丢失当前进度，确定吗？', () => resetGameState());
            } else {
                showTypeSelection();
            }
        };
        resetGameBtn.onclick = () => {
            if (currentStory) {
                showConfirm('换一个故事会丢失当前进度，确定吗？', () => changeToAnotherStory());
            } else {
                showTypeSelection();
            }
        };
    }

    async function init() {
        bindEvents();
        const resumed = await tryResumeFromSave();
        if (!resumed) {
            showTypeSelection();
        } else {
            enableBottomButtons();
        }
    }
    
    init();
})();