// === CONFIGURAÇÃO GLOBAL DO SUPABASE (PUBLICAÇÃO DE PROCESSOS) ===
// Estas são chaves PÚBLICAS por natureza (a proteção real vem das políticas de RLS
// configuradas no banco). Diferente de um token do GitHub, elas NÃO são revogadas
// por estarem visíveis no código. Cole aqui os valores do seu projeto Supabase
// (Project Settings > API): URL do projeto e a chave "anon public".
const SUPABASE_CONFIG = {
  url: "https://xkcwidluzrxodaydyxfz.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrY3dpZGx1enJ4b2RheWR5eGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTYwNjksImV4cCI6MjA5OTE5MjA2OX0.WcFpRYwnD-_qp_uyl3Va28x-QVdWRpLwZOAOCn_t-48",
  table: "processos"
};

// Base pública onde o visualizador (view.html) está hospedado (GitHub Pages).
// Ajuste se o repositório/organização for diferente.
const PUBLIC_VIEWER_BASE_URL = "https://PatrickSud.github.io/gerador-de-processos/view.html";

// === VARIÁVEIS GLOBAIS DE EDIÇÃO (ADMIN) ===
let isEditMode = false;
let savedRange = null;
let activeMediaPlaceholder = null;
let backupLayoutHTML = null;
let currentCalloutColor = 'info';

// === SISTEMA DE UNDO/REDO (HISTÓRICO) ===
let historyStack = [];
let historyIndex = -1;
let isRestoring = false;
let typingTimer;

function saveHistoryState() {
    if (isRestoring || !isEditMode) return;
    const containerHtml = document.getElementById('faqContainer').innerHTML;
    const tocHtml = document.getElementById('tocList').innerHTML;
    
    if (historyIndex >= 0 && 
        historyStack[historyIndex].container === containerHtml && 
        historyStack[historyIndex].toc === tocHtml) {
        return;
    }

    if (historyIndex < historyStack.length - 1) {
        historyStack = historyStack.slice(0, historyIndex + 1);
    }

    historyStack.push({ container: containerHtml, toc: tocHtml });
    
    if (historyStack.length > 50) {
        historyStack.shift();
    } else {
        historyIndex++;
    }
}

function undo() {
    if (!isEditMode || historyIndex <= 0) return;
    isRestoring = true;
    historyIndex--;
    restoreHistoryState();
    isRestoring = false;
}

function redo() {
    if (!isEditMode || historyIndex >= historyStack.length - 1) return;
    isRestoring = true;
    historyIndex++;
    restoreHistoryState();
    isRestoring = false;
}

function restoreHistoryState() {
    const state = historyStack[historyIndex];
    document.getElementById('faqContainer').innerHTML = state.container;
    document.getElementById('tocList').innerHTML = state.toc;
    
    bindAllSectionTitleSync();
    makeTOCDraggable();
    updateSectionFooters();
    
    document.querySelectorAll('.faq-item .a').forEach(ans => {
        Array.from(ans.children).forEach(el => attachAdminControlsToBlock(el));
    });
    document.querySelectorAll('.section').forEach(sec => injectAdminControlsToSection(sec));
    
    setElementsEditable(true);
}

// Intercepta digitações para salvar no histórico
document.addEventListener('input', (e) => {
    if (!isEditMode) return;
    
    if (e.target.classList.contains('secTitle')) {
        const section = e.target.closest('.section');
        const tocLink = document.querySelector(`.toc a[href="#${section.id}"] .toc-text`);
        if (tocLink) tocLink.textContent = e.target.textContent;
    } else if (e.target.classList.contains('toc-text')) {
        const link = e.target.closest('a');
        const targetId = link.getAttribute('href').replace('#', '');
        const secTitle = document.querySelector(`#${targetId} .secTitle`);
        if (secTitle) secTitle.textContent = e.target.textContent;
    }

    clearTimeout(typingTimer);
    typingTimer = setTimeout(saveHistoryState, 1000);
});

// Atalhos Globais de Teclado para Admin e Atalhos de Visualização
window.addEventListener('keydown', (e) => {
    if (isEditMode) {
        if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
        if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
    }

    const activeSec = document.querySelector('.section.active-tab');
    if (!activeSec) return;
    
    let rowTarget = null;
    const key = e.key.toLowerCase();
    
    if (e.ctrlKey && key === 'b') { rowTarget = document.querySelector('tr[data-shortcut="b"]'); }
    if (e.ctrlKey && key === 'i') { rowTarget = document.querySelector('tr[data-shortcut="i"]'); }
    if (e.ctrlKey && key === 'u') { rowTarget = document.querySelector('tr[data-shortcut="u"]'); }
    if (e.ctrlKey && key === 'm') { rowTarget = document.querySelector('tr[data-shortcut="m"]'); }
    if (e.altKey && e.shiftKey && key === 'alt-shift-u') { rowTarget = document.querySelector('tr[data-shortcut="alt-shift-u"]'); }
    if (e.ctrlKey && e.altKey && key === 't') { rowTarget = document.querySelector('tr[data-shortcut="t"]'); }
    
    // Suporte caso a tecla capturada seja 'u' mas com alt + shift
    if (e.altKey && e.shiftKey && key === 'u') { rowTarget = document.querySelector('tr[data-shortcut="alt-shift-u"]'); }

    if (rowTarget && !isEditMode) {
      rowTarget.classList.remove('pulsing-shortcut');
      void rowTarget.offsetWidth;
      rowTarget.classList.add('pulsing-shortcut');
    }
});

// === MÉTODOS ADMINISTRATIVOS ===
function initiateEditMode() {
    const meta = getProjectMeta();
    if (meta.isSet) {
        if (localStorage.getItem('sgd_admin_remembered') === 'true') {
            enableAdminMode();
        } else {
            document.getElementById('loginModal').classList.remove('hidden');
            setTimeout(() => document.getElementById('adminUser').focus(), 100);
        }
    } else {
        enableAdminMode();
    }
}

function submitLogin() {
    const user = document.getElementById('adminUser').value;
    const pass = document.getElementById('adminPass').value;
    const meta = getProjectMeta();
    
    if (user === meta.user && pass === meta.pass) {
        if(document.getElementById('rememberCreds').checked) {
            localStorage.setItem('sgd_admin_remembered', 'true');
        }
        closeModal('loginModal');
        document.getElementById('adminUser').value = '';
        document.getElementById('adminPass').value = '';
        enableAdminMode();
    } else {
        alert("❌ Acesso negado! Credenciais inválidas.");
    }
}

function enableAdminMode() {
    isEditMode = true;
    document.body.classList.add('edit-mode-active');
    
    historyStack = [];
    historyIndex = -1;
    saveHistoryState();

    document.getElementById('editProjectBtn').classList.add('hidden');
    
    setElementsEditable(true);
    injectFormatToolbar();
    injectAdminControls();
    makeTOCDraggable();
    bindAllSectionTitleSync();
    
    document.querySelectorAll('.faq-item .a').forEach(ans => {
        Array.from(ans.children).forEach(el => attachAdminControlsToBlock(el));
    });
}

function saveEdits() {
    saveHistoryState(); 
    alert("💾 Alterações salvas na memória temporária do navegador!");
}

function saveAndCloseEdits() {
    saveHistoryState();
    disableAdminMode();
}

function cancelEdits() {
    if(confirm("⚠️ Atenção: Isso descartará todas as alterações voltando ao estado inicial salvo. Deseja continuar?")) {
        if(historyStack.length > 0) {
            historyIndex = 0;
            restoreHistoryState();
        }
        disableAdminMode();
    }
}

function disableAdminMode() {
  isEditMode = false;
  document.body.classList.remove('edit-mode-active');
  document.getElementById('editProjectBtn').classList.remove('hidden');
  
  setElementsEditable(false);
  cleanupAdminUI();
  document.querySelectorAll('.toc > ul > li').forEach(li => { li.removeAttribute('draggable'); });
  initTabNavigation();
  updateOverallProgress();
}

function setElementsEditable(editable) {
  const state = editable ? "true" : "false";
  const targets = document.querySelectorAll(
    '#editable-main-title, #editable-main-subtitle, .secTitle, .qText, .a p, .a li, table th, table td, .callout strong, .toc-text, .yt-text strong'
  );
  targets.forEach(el => el.setAttribute('contenteditable', state));
}

function bindAllSectionTitleSync() {
    document.querySelectorAll('.secTitle').forEach(titleEl => {
        if(!titleEl.dataset.syncBound) {
            titleEl.dataset.syncBound = "true";
        }
    });
}

function makeTOCDraggable() {
   const tocItems = document.querySelectorAll('.toc > ul > li');
   let draggedItem = null;

   tocItems.forEach(item => {
       item.setAttribute('draggable', 'true');
       item.addEventListener('dragstart', function(e) {
           if(!isEditMode) { e.preventDefault(); return; }
           draggedItem = this; e.dataTransfer.effectAllowed = 'move';
           setTimeout(() => this.classList.add('is-dragging'), 0);
       });
       item.addEventListener('dragend', function() {
           this.classList.remove('is-dragging');
           document.querySelectorAll('.toc > ul > li').forEach(i => i.classList.remove('drag-over-top', 'drag-over-bottom'));
           draggedItem = null;
           saveHistoryState();
       });
       item.addEventListener('dragover', function(e) {
           e.preventDefault();
           if(!isEditMode || this === draggedItem) return;
           const rect = this.getBoundingClientRect();
           const isBottomHalf = (e.clientY - rect.top) / rect.height > 0.5;
           this.classList.remove('drag-over-top', 'drag-over-bottom');
           this.classList.add(isBottomHalf ? 'drag-over-bottom' : 'drag-over-top');
       });
       item.addEventListener('dragleave', function() { this.classList.remove('drag-over-top', 'drag-over-bottom'); });
       item.addEventListener('drop', function(e) {
           e.preventDefault();
           if(!isEditMode || this === draggedItem) return;
           this.classList.remove('drag-over-top', 'drag-over-bottom');
           const rect = this.getBoundingClientRect();
           const isBottomHalf = (e.clientY - rect.top) / rect.height > 0.5;
           if (isBottomHalf) { this.parentNode.insertBefore(draggedItem, this.nextSibling); } 
           else { this.parentNode.insertBefore(draggedItem, this); }
           reorderSectionsInDOM();
       });
   });
}

function reorderSectionsInDOM() {
   const container = document.getElementById('faqContainer');
   document.querySelectorAll('.toc > ul > li > a').forEach(link => {
       const targetId = link.getAttribute('href').replace('#', '');
       const section = document.getElementById(targetId);
       if(section) container.appendChild(section);
   });
   const addBtn = document.querySelector('.admin-add-section-btn');
   if(addBtn) container.appendChild(addBtn);
   updateSectionFooters();
}

function injectFormatToolbar() {
  if(document.getElementById('admin-format-toolbar')) return;
  
  const tbTop = document.createElement('div');
  tbTop.id = 'admin-format-toolbar';
  tbTop.innerHTML = `
    <div class="tb-row">
        <button onmousedown="event.preventDefault(); document.execCommand('bold', false, null); saveHistoryState();" title="Negrito (Ctrl+B)">B</button>
        <button onmousedown="event.preventDefault(); document.execCommand('italic', false, null); saveHistoryState();" title="Itálico (Ctrl+I)">I</button>
        <button onmousedown="event.preventDefault(); document.execCommand('underline', false, null); saveHistoryState();" title="Sublinhado (Ctrl+U)">U</button>
        
        <div class="sep"></div>
        
        <div class="tb-dropdown" title="Cor do Texto">
           <button onmousedown="event.preventDefault(); toggleToolbarDropdown('dd-color', 'flex');">🎨</button>
           <div id="dd-color" class="tb-dropdown-content">
               <button style="background: #ef4444; width:20px; height:20px; padding:0;" onmousedown="event.preventDefault(); document.execCommand('foreColor', false, '#ef4444'); closeAllDropdowns(); saveHistoryState();"></button>
               <button style="background: #3b82f6; width:20px; height:20px; padding:0;" onmousedown="event.preventDefault(); document.execCommand('foreColor', false, '#3b82f6'); closeAllDropdowns(); saveHistoryState();"></button>
               <button style="background: #10b981; width:20px; height:20px; padding:0;" onmousedown="event.preventDefault(); document.execCommand('foreColor', false, '#10b981'); closeAllDropdowns(); saveHistoryState();"></button>
               <button style="background: #f59e0b; width:20px; height:20px; padding:0;" onmousedown="event.preventDefault(); document.execCommand('foreColor', false, '#f59e0b'); closeAllDropdowns(); saveHistoryState();"></button>
               <button style="background: #1e293b; width:20px; height:20px; padding:0;" onmousedown="event.preventDefault(); document.execCommand('foreColor', false, '#1e293b'); closeAllDropdowns(); saveHistoryState();"></button>
           </div>
        </div>

        <div class="tb-dropdown" title="Cor de Destaque">
           <button onmousedown="event.preventDefault(); toggleToolbarDropdown('dd-hilite', 'flex');">🖍️</button>
           <div id="dd-hilite" class="tb-dropdown-content">
               <button style="background: #fecaca; width:20px; height:20px; padding:0;" onmousedown="event.preventDefault(); document.execCommand('hiliteColor', false, '#fecaca'); document.execCommand('backColor', false, '#fecaca'); closeAllDropdowns(); saveHistoryState();"></button>
               <button style="background: #bfdbfe; width:20px; height:20px; padding:0;" onmousedown="event.preventDefault(); document.execCommand('hiliteColor', false, '#bfdbfe'); document.execCommand('backColor', false, '#bfdbfe'); closeAllDropdowns(); saveHistoryState();"></button>
               <button style="background: #bbf7d0; width:20px; height:20px; padding:0;" onmousedown="event.preventDefault(); document.execCommand('hiliteColor', false, '#bbf7d0'); document.execCommand('backColor', false, '#bbf7d0'); closeAllDropdowns(); saveHistoryState();"></button>
               <button style="background: #fef08a; width:20px; height:20px; padding:0;" onmousedown="event.preventDefault(); document.execCommand('hiliteColor', false, '#fef08a'); document.execCommand('backColor', false, '#fef08a'); closeAllDropdowns(); saveHistoryState();"></button>
               <button style="background: #e2e8f0; width:20px; height:20px; padding:0; color:#000; font-size:10px; display:flex; align-items:center; justify-content:center;" onmousedown="event.preventDefault(); document.execCommand('hiliteColor', false, 'transparent'); document.execCommand('backColor', false, 'transparent'); closeAllDropdowns(); saveHistoryState();" title="Remover">X</button>
           </div>
        </div>

        <div class="tb-dropdown" title="Emojis">
          <button onmousedown="event.preventDefault(); toggleToolbarDropdown('dd-emoji', 'grid');">😀</button>
          <div id="dd-emoji" class="tb-dropdown-content emoji-grid">
             <button onmousedown="event.preventDefault(); document.execCommand('insertText', false, '😀'); closeAllDropdowns(); saveHistoryState();">😀</button>
             <button onmousedown="event.preventDefault(); document.execCommand('insertText', false, '😂'); closeAllDropdowns(); saveHistoryState();">😂</button>
             <button onmousedown="event.preventDefault(); document.execCommand('insertText', false, '🥰'); closeAllDropdowns(); saveHistoryState();">🥰</button>
             <button onmousedown="event.preventDefault(); document.execCommand('insertText', false, '😎'); closeAllDropdowns(); saveHistoryState();">😎</button>
             <button onmousedown="event.preventDefault(); document.execCommand('insertText', false, '🤔'); closeAllDropdowns(); saveHistoryState();">🤔</button>
             <button onmousedown="event.preventDefault(); document.execCommand('insertText', false, '🙌'); closeAllDropdowns(); saveHistoryState();">🙌</button>
             <button onmousedown="event.preventDefault(); document.execCommand('insertText', false, '👍'); closeAllDropdowns(); saveHistoryState();">👍</button>
             <button onmousedown="event.preventDefault(); document.execCommand('insertText', false, '👏'); closeAllDropdowns(); saveHistoryState();">👏</button>
             <button onmousedown="event.preventDefault(); document.execCommand('insertText', false, '🤝'); closeAllDropdowns(); saveHistoryState();">🤝</button>
             <button onmousedown="event.preventDefault(); document.execCommand('insertText', false, '💪'); closeAllDropdowns(); saveHistoryState();">💪</button>
             <button onmousedown="event.preventDefault(); document.execCommand('insertText', false, '💡'); closeAllDropdowns(); saveHistoryState();">💡</button>
             <button onmousedown="event.preventDefault(); document.execCommand('insertText', false, '✅'); closeAllDropdowns(); saveHistoryState();">✅</button>
             <button onmousedown="event.preventDefault(); document.execCommand('insertText', false, '❌'); closeAllDropdowns(); saveHistoryState();">❌</button>
             <button onmousedown="event.preventDefault(); document.execCommand('insertText', false, '⚠️'); closeAllDropdowns(); saveHistoryState();">⚠️</button>
             <button onmousedown="event.preventDefault(); document.execCommand('insertText', false, '🔥'); closeAllDropdowns(); saveHistoryState();">🔥</button>
             <button onmousedown="event.preventDefault(); document.execCommand('insertText', false, '✨'); closeAllDropdowns(); saveHistoryState();">✨</button>
             <button onmousedown="event.preventDefault(); document.execCommand('insertText', false, '📌'); closeAllDropdowns(); saveHistoryState();">📌</button>
             <button onmousedown="event.preventDefault(); document.execCommand('insertText', false, '🚀'); closeAllDropdowns(); saveHistoryState();">🚀</button>
             <button onmousedown="event.preventDefault(); document.execCommand('insertText', false, '💻'); closeAllDropdowns(); saveHistoryState();">💻</button>
             <button onmousedown="event.preventDefault(); document.execCommand('insertText', false, '⚙️'); closeAllDropdowns(); saveHistoryState();">⚙️</button>
             <button onmousedown="event.preventDefault(); document.execCommand('insertText', false, '🛠️'); closeAllDropdowns(); saveHistoryState();">🛠️</button>
             <button onmousedown="event.preventDefault(); document.execCommand('insertText', false, '📊'); closeAllDropdowns(); saveHistoryState();">📊</button>
             <button onmousedown="event.preventDefault(); document.execCommand('insertText', false, '📈'); closeAllDropdowns(); saveHistoryState();">📈</button>
             <button onmousedown="event.preventDefault(); document.execCommand('insertText', false, '📝'); closeAllDropdowns(); saveHistoryState();">📝</button>
             <button onmousedown="event.preventDefault(); document.execCommand('insertText', false, '📎'); closeAllDropdowns(); saveHistoryState();">📎</button>
          </div>
        </div>

        <div class="sep"></div>
        
        <div class="tb-dropdown" title="Alinhamento">
           <button onmousedown="event.preventDefault(); toggleToolbarDropdown('dd-align', 'flex');">≡</button>
           <div id="dd-align" class="tb-dropdown-content">
              <button onmousedown="event.preventDefault(); document.execCommand('justifyLeft', false, null); closeAllDropdowns(); saveHistoryState();" title="Esquerda">⫷</button>
              <button onmousedown="event.preventDefault(); document.execCommand('justifyCenter', false, null); closeAllDropdowns(); saveHistoryState();" title="Centro">≡</button>
              <button onmousedown="event.preventDefault(); document.execCommand('justifyRight', false, null); closeAllDropdowns(); saveHistoryState();" title="Direita">⫸</button>
           </div>
        </div>

        <div class="sep"></div>
        <button onmousedown="event.preventDefault(); document.execCommand('insertOrderedList', false, null); saveHistoryState();" title="Lista Numerada">1.</button>
        <button onmousedown="event.preventDefault(); document.execCommand('insertUnorderedList', false, null); saveHistoryState();" title="Lista Marcadores">•</button>
        <div class="sep"></div>
        
        <button onmousedown="event.preventDefault(); openCalloutModal();" title="Inserir Caixa de Anotação">💡</button>
        <button onmousedown="event.preventDefault(); openLinkModal();" title="Inserir Link">🔗</button>
        <button onmousedown="event.preventDefault(); applyMarkdownToSelection();" title="Converter Markdown para HTML">MD</button>
    </div>
  `;
  document.body.appendChild(tbTop);

  const tbBottom = document.createElement('div');
  tbBottom.id = 'admin-action-toolbar';
  tbBottom.innerHTML = `
    <button onmousedown="event.preventDefault(); saveEdits();" style="color: #10b981;">💾 Salvar</button>
    <button onmousedown="event.preventDefault(); saveAndCloseEdits();" style="color: #10b981;">✅ Concluir</button>
    <div class="sep"></div>
    <button onmousedown="event.preventDefault(); cancelEdits();" style="color: #ef4444;">❌ Descartar</button>
    <button onmousedown="event.preventDefault(); copyShareLink();" style="color: #6366f1;">🔗 Copiar Link</button>
    <button onmousedown="event.preventDefault(); openPublishModal();" style="color: #3b82f6;">🚀 Publicar Processo</button>
    <button onmousedown="event.preventDefault(); exportUpdatedHTML();" style="color: #ea580c;">📦 Exportar (.html)</button>
  `;
  document.body.appendChild(tbBottom);
}

function toggleToolbarDropdown(id, displayType) {
    const el = document.getElementById(id);
    const isCurrentlyOpen = el.classList.contains('show-flex') || el.classList.contains('show-grid');
    closeAllDropdowns();
    if (!isCurrentlyOpen) {
        el.classList.add(displayType === 'grid' ? 'show-grid' : 'show-flex');
    }
}

function closeAllDropdowns() {
    document.querySelectorAll('.tb-dropdown-content').forEach(el => {
        el.classList.remove('show-flex', 'show-grid');
    });
}

document.addEventListener('mousedown', function(e) {
    if (!e.target.closest('.tb-dropdown')) {
        closeAllDropdowns();
    }
});

function openLinkModal() {
    if (window.getSelection) {
        const sel = window.getSelection();
        if (sel.getRangeAt && sel.rangeCount) {
            savedRange = sel.getRangeAt(0);
            document.getElementById('linkDesc').value = sel.toString();
        }
    }
    document.getElementById('linkModal').classList.remove('hidden');
    setTimeout(() => document.getElementById('linkUrl').focus(), 100);
}

function submitLink() {
    let url = document.getElementById('linkUrl').value.trim();
    const desc = document.getElementById('linkDesc').value || url;
    if(!url) { alert("A URL é obrigatória!"); return; }
    
    if (!/^https?:\/\//i.test(url) && !url.startsWith('mailto:') && !url.startsWith('tel:')) { url = 'https://' + url; }
    
    closeModal('linkModal');
    if(savedRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
    }
    document.execCommand('insertHTML', false, `<a href="${url}" target="_blank">${desc}</a>`);
    saveHistoryState();
    document.getElementById('linkUrl').value = ''; document.getElementById('linkDesc').value = '';
}

function selectCalloutColor(color, el) {
    currentCalloutColor = color;
    document.querySelectorAll('.color-swatch').forEach(sw => sw.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('calloutPreview').className = `callout ${color}`;
}

function openCalloutModal() {
    if (window.getSelection && window.getSelection().rangeCount > 0) {
        savedRange = window.getSelection().getRangeAt(0);
    }
    document.getElementById('calloutModal').classList.remove('hidden');
    document.getElementById('previewTitle').innerText = 'EXEMPLO';
    document.getElementById('previewText').innerText = 'Digite o conteúdo da anotação...';
    setTimeout(() => document.getElementById('previewTitle').focus(), 100);
}

function submitCallout() {
    const title = document.getElementById('previewTitle').innerText.trim() || 'EXEMPLO';
    const text = document.getElementById('previewText').innerText.trim();
    
    if (!text || text === 'Digite o conteúdo da anotação...') { alert("O texto é obrigatório."); return; }
    closeModal('calloutModal');
    
    let targetA = null;
    if (savedRange) {
        const node = savedRange.startContainer;
        const aNode = node.nodeType === 3 ? node.parentNode.closest('.a') : node.closest('.a');
        if (aNode) targetA = aNode;
    }
    if (!targetA) {
        const openDetails = document.querySelector('details.faq-item[open]');
        if(openDetails) targetA = openDetails.querySelector('.a');
    }

    if (targetA) {
        const div = document.createElement('div');
        div.innerHTML = `<div class="callout ${currentCalloutColor}" contenteditable="false"><strong contenteditable="${isEditMode ? 'true' : 'false'}">${title}</strong><span contenteditable="${isEditMode ? 'true' : 'false'}">${text}</span></div>`;
        const calloutEl = div.firstElementChild;
        const ctrlDiv = targetA.querySelector('.admin-block-controls');
        targetA.insertBefore(calloutEl, ctrlDiv);
        if (isEditMode) attachAdminControlsToBlock(calloutEl);
        saveHistoryState();
    }
    selectCalloutColor('info', document.querySelector('.swatch-info')); 
}

function applyMarkdownToSelection() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (range.collapsed) { alert("Selecione o texto com formatação Markdown para converter."); return; }
  const div = document.createElement('div');
  div.appendChild(range.cloneContents());
  let text = div.innerText || div.textContent; 
  let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color: var(--sgd-blue); font-weight: bold;">$1</a>').replace(/\n/g, '<br>');
  document.execCommand('insertHTML', false, html);
  saveHistoryState();
}

function injectAdminControls() {
  let addSecBtn = document.querySelector('.admin-add-section-btn');
  if (!addSecBtn) {
      addSecBtn = document.createElement('button');
      addSecBtn.className = 'admin-add-section-btn';
      addSecBtn.innerText = '+ Adicionar Nova Seção';
      addSecBtn.onclick = () => {
          const newId = 'sec-' + Date.now();
          const newSec = document.createElement('section');
          newSec.className = 'section';
          newSec.id = newId;
          newSec.innerHTML = `
              <div class="sectionHeader">
                  <h2 class="secTitle" contenteditable="true" data-sync-bound="true">Nova Seção</h2>
                  <div class="header-actions"><button class="btn btn-outline btn-unmark-all" onclick="uncheckSectionProgress('${newId}')">↺ Desmarcar Todos</button></div>
              </div>
              <div class="section-nav-footer"><button class="btn" onclick="goToNextSection(this)"></button></div>
          `;
          const container = document.getElementById('faqContainer');
          container.insertBefore(newSec, addSecBtn);
          
          const tocUl = document.querySelector('.toc > ul');
          const newLi = document.createElement('li');
          newLi.innerHTML = `<a href="#${newId}"><span class="toc-text" contenteditable="true">Nova Seção</span></a>`;
          tocUl.appendChild(newLi);
          
          bindAllSectionTitleSync(); injectAdminControlsToSection(newSec); makeTOCDraggable(); updateSectionFooters(); switchTab(newId, false);
          saveHistoryState();
      };
      document.getElementById('faqContainer').appendChild(addSecBtn);
  }
  document.querySelectorAll('.section').forEach(sec => injectAdminControlsToSection(sec));
}

function injectAdminControlsToSection(sec) {
  const headerActions = sec.querySelector('.header-actions');
  if (headerActions && !headerActions.querySelector('.admin-delete-sec-btn')) {
      const delBtn = document.createElement('button');
      delBtn.className = 'admin-delete-sec-btn admin-faq-header-controls';
      delBtn.innerText = '🗑️ Excluir Seção';
      delBtn.onclick = (e) => {
          e.stopPropagation();
          if(confirm("Tem certeza que deseja excluir esta SEÇÃO inteira e todos os seus tópicos?")) {
              const secId = sec.id;
              const tocLi = document.querySelector(`.toc a[href="#${secId}"]`).closest('li');
              sec.remove(); tocLi.remove(); updateSectionFooters();
              const firstTab = document.querySelector('.section');
              if(firstTab) switchTab(firstTab.id);
              saveHistoryState();
          }
      };
      headerActions.appendChild(delBtn);
  }

  if(!sec.querySelector('.admin-add-faq-btn')) {
    const btn = document.createElement('button');
    btn.className = 'admin-add-faq-btn';
    btn.innerText = '+ Adicionar Novo Tópico/Pergunta';
    btn.onclick = () => {
      const newId = 'q-new-' + Date.now();
      const details = document.createElement('details');
      details.className = 'q faq-item'; details.id = newId; details.setAttribute('open', '');
      details.innerHTML = `
        <summary><span class="sumLeft"><span class="q-checkbox" onclick="toggleProgress('${newId}', event)"></span><span class="qText" contenteditable="true">Escreva o título do tópico aqui...</span></span><span class="chev">▼</span></summary>
        <div class="a"><p contenteditable="true">Escreva o conteúdo aqui...</p></div>
      `;
      const footer = sec.querySelector('.section-nav-footer');
      if(footer) sec.insertBefore(details, footer);
      else sec.appendChild(details);
      
      injectAdminControlsToFaqItem(details); updateTOCCounters();
      saveHistoryState();
    };
    const footer = sec.querySelector('.section-nav-footer');
    if(footer) sec.insertBefore(btn, footer); else sec.appendChild(btn);
  }
  sec.querySelectorAll('.faq-item').forEach(faq => { injectAdminControlsToFaqItem(faq); });
}

function injectAdminControlsToFaqItem(faq) {
  const ans = faq.querySelector('.a');
  if(!ans) return;

  if(!faq.querySelector('.admin-delete-faq-btn')) {
     const summary = faq.querySelector('summary');
     const delBtn = document.createElement('button');
     delBtn.className = 'admin-delete-faq-btn admin-faq-header-controls';
     delBtn.innerText = '🗑️ Excluir Tópico';
     delBtn.onclick = (e) => {
        e.stopPropagation();
        if(confirm("Tem certeza que deseja excluir este tópico?")) { faq.remove(); updateTOCCounters(); saveHistoryState(); }
     };
     summary.appendChild(delBtn);
  }

  if(!ans.querySelector('.admin-block-controls')) {
    const ctrlDiv = document.createElement('div');
    ctrlDiv.className = 'admin-block-controls';
    
    const btnText = document.createElement('button');
    btnText.className = 'admin-add-text-btn'; btnText.innerText = '+ Adicionar Texto';
    btnText.onclick = (e) => {
      const p = document.createElement('p'); p.setAttribute('contenteditable', 'true'); p.innerText = 'Novo bloco de texto...';
      ans.insertBefore(p, ctrlDiv); attachAdminControlsToBlock(p); saveHistoryState();
    };

    const btnMedia = document.createElement('button');
    btnMedia.className = 'admin-add-media-btn'; btnMedia.innerText = '+ Adicionar Imagem ou YouTube';
    btnMedia.onclick = (e) => {
      const newPlaceholder = document.createElement('div'); newPlaceholder.className = 'media-placeholder';
      newPlaceholder.innerHTML = '<span>🖼️ [Clique para inserir URL, YouTube ou Arquivo de Imagem/GIF]</span>';
      ans.insertBefore(newPlaceholder, ctrlDiv); attachAdminControlsToBlock(newPlaceholder); saveHistoryState();
    };

    ctrlDiv.appendChild(btnText); ctrlDiv.appendChild(btnMedia); ans.appendChild(ctrlDiv);
  }

  Array.from(ans.children).forEach(el => attachAdminControlsToBlock(el));
}

function attachAdminControlsToBlock(el) {
  if (!el || el.classList.contains('admin-block-controls')) return;
  if (el.querySelector('.admin-element-controls')) return;

  const ctrl = document.createElement('div');
  ctrl.className = 'admin-element-controls';
  ctrl.innerHTML = `<button class="move-up" title="Mover para cima">⬆️</button><button class="move-down" title="Mover para baixo">⬇️</button><button class="delete-block" title="Excluir este bloco">🗑️</button>`;
  
  if(el.firstChild) { el.insertBefore(ctrl, el.firstChild); } else { el.appendChild(ctrl); }

  ctrl.querySelector('.move-up').onclick = (e) => {
    e.stopPropagation();
    const prev = el.previousElementSibling;
    if (prev && !prev.classList.contains('admin-block-controls')) { el.parentNode.insertBefore(el, prev); saveHistoryState();}
  };
  ctrl.querySelector('.move-down').onclick = (e) => {
    e.stopPropagation();
    const next = el.nextElementSibling;
    if (next && !next.classList.contains('admin-block-controls')) { el.parentNode.insertBefore(next, el); saveHistoryState();}
  };
  ctrl.querySelector('.delete-block').onclick = (e) => {
    e.stopPropagation();
    if(confirm("Excluir este bloco de conteúdo?")) { el.remove(); saveHistoryState(); }
  };
}

function cleanupAdminUI() {
  document.getElementById('admin-format-toolbar')?.remove();
  document.getElementById('admin-action-toolbar')?.remove();
  document.querySelectorAll('.admin-add-faq-btn, .admin-add-section-btn, .admin-block-controls, .admin-faq-header-controls, .admin-element-controls').forEach(b => b.remove());
  document.querySelectorAll('.resizer-wrap').forEach(w => { w.style.resize = 'none'; w.style.border = 'none'; });
  document.querySelectorAll('.modal-input').forEach(i => i.value = '');
}

// === GESTÃO DO MODAL DE MÍDIA HÍBRIDO (YOUTUBE, URL E BASE64) ===
document.addEventListener('click', (e) => {
  if (!isEditMode) return;
  if (e.target.closest('.admin-element-controls') || e.target.closest('.admin-block-controls') || e.target.closest('.tb-dropdown')) return;

  const placeholder = e.target.closest('.media-placeholder') || e.target.closest('.resizer-wrap') || e.target.closest('.yt-card') || e.target.closest('.video-container');
  if (placeholder && !e.target.closest('summary')) {
    e.preventDefault();
    activeMediaPlaceholder = placeholder;
    
    const currentImg = activeMediaPlaceholder.querySelector('img');
    const currentIframe = activeMediaPlaceholder.querySelector('iframe');
    const currentYt = activeMediaPlaceholder.classList.contains('yt-card') ? activeMediaPlaceholder : null;
    
    if (currentImg) {
        document.getElementById('mediaUrl').value = currentImg.getAttribute('src').startsWith('data:') ? '' : currentImg.getAttribute('src');
        document.getElementById('ytTitle').value = '';
    } else if (currentIframe) {
        const iframeSrc = currentIframe.getAttribute('src');
        const ytRegex = /embed\/([^"&?\/\s]{11})/i;
        const ytMatch = iframeSrc.match(ytRegex);
        if (ytMatch && ytMatch[1]) {
            document.getElementById('mediaUrl').value = `https://www.youtube.com/watch?v=${ytMatch[1]}`;
        } else {
            document.getElementById('mediaUrl').value = iframeSrc;
        }
        document.getElementById('ytTitle').value = '';
    } else if (currentYt) {
        document.getElementById('mediaUrl').value = currentYt.getAttribute('href');
        document.getElementById('ytTitle').value = currentYt.querySelector('strong').innerText;
    } else {
        document.getElementById('mediaUrl').value = ''; document.getElementById('ytTitle').value = '';
    }
    document.getElementById('mediaFile').value = '';
    document.getElementById('mediaModal').classList.remove('hidden');
  }
});

function submitMedia() {
    if (!activeMediaPlaceholder) return;
    const fileInput = document.getElementById('mediaFile');
    const urlInput = document.getElementById('mediaUrl').value.trim();
    const ytTitle = document.getElementById('ytTitle').value.trim() || 'Vídeo do YouTube';
    
    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) { renderMedia(e.target.result, false); };
        reader.readAsDataURL(fileInput.files[0]);
    } else if (urlInput) {
        const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const ytMatch = urlInput.match(ytRegex);
        if (ytMatch && ytMatch[1]) {
            const ytId = ytMatch[1];
            const watchUrl = `https://www.youtube.com/watch?v=${ytId}`;
            renderMedia(watchUrl, true, ytTitle);
        } else {
            renderMedia(urlInput, false);
        }
    } else {
        alert("Insira uma URL válida ou selecione um arquivo de imagem.");
    }
}

function renderMedia(src, isYouTube, ytTitle = "") {
    if(!activeMediaPlaceholder) return;
    
    const div = document.createElement('div');
    if (isYouTube) {
        const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const ytMatch = src.match(ytRegex);
        const ytId = ytMatch ? ytMatch[1] : '';
        
        div.innerHTML = `
        <div class="video-container" contenteditable="false">
            <iframe src="https://www.youtube-nocookie.com/embed/${ytId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
        </div>`;
    } else {
        div.innerHTML = `<div class="resizer-wrap"><img src="${src}" alt="Apresentação do Recurso"></div>`;
    }
    
    const newEl = div.firstElementChild;
    activeMediaPlaceholder.parentNode.insertBefore(newEl, activeMediaPlaceholder);
    activeMediaPlaceholder.remove();
    attachAdminControlsToBlock(newEl);
    
    closeModal('mediaModal');
    activeMediaPlaceholder = null;
    saveHistoryState();
}

function clearMedia() {
    if(!activeMediaPlaceholder) return;
    const div = document.createElement('div');
    div.innerHTML = `<div class="media-placeholder"><span>🖼️ [Clique para inserir URL, YouTube ou Arquivo de Imagem/GIF]</span></div>`;
    const newEl = div.firstElementChild;
    activeMediaPlaceholder.parentNode.insertBefore(newEl, activeMediaPlaceholder);
    activeMediaPlaceholder.remove();
    attachAdminControlsToBlock(newEl);
    closeModal('mediaModal');
    activeMediaPlaceholder = null;
    saveHistoryState();
}

function exportUpdatedHTML() {
  const meta = getProjectMeta();
  if (!meta.isSet) {
      document.getElementById('setupCredentialsModal').classList.remove('hidden');
  } else { performExport(); }
}

function submitSetupCredentials() {
    const u = document.getElementById('newUser').value.trim();
    const p = document.getElementById('newPass').value.trim();
    if(!u || !p) { alert("Preencha usuário e senha!"); return; }
    setProjectMeta({ isSet: true, user: u, pass: p });
    closeModal('setupCredentialsModal');
    performExport();
}

function performExport() {
  disableAdminMode();
  const checkbox = document.getElementById('themeToggleCheckbox');
  if (document.body.classList.contains('theme-dark-tech')) { checkbox.setAttribute('checked', 'checked'); } 
  else { checkbox.removeAttribute('checked'); }

  document.body.setAttribute('data-is-new', 'false');

  setTimeout(() => {
    const updatedCode = "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
    const blob = new Blob([updatedCode], { type: 'text/html' });
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = 'Projeto_Exportado.html';
    document.body.appendChild(downloadLink);
    downloadLink.click(); document.body.removeChild(downloadLink); URL.revokeObjectURL(downloadLink.href);
  }, 300);
}

// === PUBLICAÇÃO DE PROCESSO ONLINE (SUPABASE) ===
function openPublishModal() {
  if (!SUPABASE_CONFIG.url || SUPABASE_CONFIG.url.includes('COLE_A_URL') ||
      !SUPABASE_CONFIG.anonKey || SUPABASE_CONFIG.anonKey.includes('COLE_SUA_ANON')) {
    alert("⚠️ Atenção: Para publicar processos online, você precisa configurar a URL e a chave 'anon public' do seu projeto Supabase no início do arquivo 'admin.js' (SUPABASE_CONFIG)!");
    return;
  }

  var preSlug = window.currentPublishSlug || '';
  document.getElementById('publishSlug').value = preSlug;
  document.getElementById('publishPreviewSlug').textContent = preSlug || 'onboarding-vendas';
  const reqNameEl = document.getElementById('publishRequireName');
  if (reqNameEl) reqNameEl.checked = false;
  document.getElementById('publishProcessModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('publishSlug').focus(), 100);
}

function updatePublishSlugPreview(val) {
  const cleanVal = val.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');
  document.getElementById('publishSlug').value = cleanVal;
  document.getElementById('publishPreviewSlug').textContent = cleanVal || 'onboarding-vendas';
}

async function submitPublishProcess() {
  const slug = document.getElementById('publishSlug').value.trim();
  if (!slug) {
    alert("❌ O identificador (Slug) do processo é obrigatório!");
    return;
  }

  const requireNameEl = document.getElementById('publishRequireName');
  const requireName = !!(requireNameEl && requireNameEl.checked);
  const autor = (getProjectMeta().user || '').trim();

  showLoader("Processando código do manual...");

  const wasEditMode = isEditMode;
  if (wasEditMode) {
    disableAdminMode();
  }

  // Clona o documento para fazer a limpeza de segurança antes de enviar ao banco
  const htmlClone = document.documentElement.cloneNode(true);

  // 1. Remove scripts administrativos
  const adminScript = htmlClone.querySelector('script[src="admin.js"]');
  if (adminScript) adminScript.remove();

  // 2. Remove modais e overlays de edição
  htmlClone.querySelectorAll('.modal-overlay, #globalLoader, #admin-format-toolbar, #admin-action-toolbar').forEach(el => el.remove());

  // 3. Remove o botão de "Editar Projeto" do topo da tela, deixando apenas a visualização
  const editBtn = htmlClone.querySelector('#editProjectBtn');
  if (editBtn) editBtn.remove();

  // 4. Limpa atributos de body que ativam edição ou status novo
  const bodyEl = htmlClone.querySelector('body');
  if (bodyEl) {
    bodyEl.classList.remove('edit-mode-active');
    bodyEl.setAttribute('data-is-new', 'false');
    // Carimba o contexto para o tracker.js saber que e uma pagina publicada
    bodyEl.setAttribute('data-slug', slug);
    bodyEl.setAttribute('data-access-control', requireName ? 'true' : 'false');
  }

  const cleanHTML = "<!DOCTYPE html>\n" + htmlClone.outerHTML;
  const tituloProcesso = document.getElementById('editable-main-title').textContent.trim();

  if (wasEditMode) {
    enableAdminMode();
  }

  try {
    showLoader("Publicando processo (Supabase)...");

    const endpoint = `${SUPABASE_CONFIG.url.replace(/\/+$/, '')}/rest/v1/${SUPABASE_CONFIG.table}?on_conflict=slug`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_CONFIG.anonKey,
        "Authorization": `Bearer ${SUPABASE_CONFIG.anonKey}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify([{
        slug: slug,
        titulo: tituloProcesso,
        autor: autor || null,
        require_name: requireName,
        html: cleanHTML,
        updated_at: new Date().toISOString()
      }])
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || `HTTP ${res.status}`);
    }

    const publicLink = `${PUBLIC_VIEWER_BASE_URL}?p=${encodeURIComponent(slug)}`;

    document.getElementById("publicProcessLink").href = publicLink;
    document.getElementById("publicProcessLink").textContent = publicLink;

    closeModal("publishProcessModal");
    document.getElementById("publishSuccessModal").classList.remove("hidden");

    navigator.clipboard.writeText(publicLink).catch(e => console.log("Cópia automática indisponível"));

  } catch (error) {
    alert("❌ Erro ao publicar o processo:\n" + error.message);
  } finally {
    hideLoader();
  }
}

function copyPublicProcessLink() {
  const linkText = document.getElementById("publicProcessLink").href;
  navigator.clipboard.writeText(linkText).then(() => {
    alert("📋 Link público copiado para a área de transferência!");
  }).catch(err => {
    alert("Não foi possível copiar automaticamente. Copie manualmente do link na tela.");
  });
}

function showLoader(text) {
  document.getElementById("globalLoaderText").textContent = text;
  document.getElementById("globalLoader").classList.remove("hidden");
}

// === COMPRESSÃO E COMPARTILHAMENTO DE PROCESSO ===
function getSerializedData() {
  const title = document.getElementById('editable-main-title').textContent.trim();
  const subtitle = document.getElementById('editable-main-subtitle').textContent.trim();
  
  const sections = [];
  document.querySelectorAll('.section').forEach(sec => {
    const secTitle = sec.querySelector('.secTitle').textContent.trim();
    const faqs = [];
    
    sec.querySelectorAll('details.faq-item').forEach(faq => {
      const faqTitle = faq.querySelector('.qText').textContent.trim();
      const ans = faq.querySelector('.a');
      
      const ansClone = ans.cloneNode(true);
      ansClone.querySelectorAll('.admin-block-controls, .admin-element-controls, .admin-faq-header-controls').forEach(el => el.remove());
      
      faqs.push({
        id: faq.id,
        title: faqTitle,
        answer: ansClone.innerHTML
      });
    });
    
    sections.push({
      id: sec.id,
      title: secTitle,
      faqs: faqs
    });
  });
  
  return JSON.stringify({ title, subtitle, sections });
}

async function copyShareLink() {
  try {
    showLoader("Gerando link de compartilhamento...");
    const jsonStr = getSerializedData();
    const compressed = await compressData(jsonStr);
    
    const baseUrl = window.location.href.split('#')[0];
    const shareUrl = `${baseUrl}#data=${compressed}`;
    
    document.getElementById('shareLinkInput').value = shareUrl;
    document.getElementById('shareLinkModal').classList.remove('hidden');
  } catch (e) {
    console.error("Erro ao gerar link de compartilhamento:", e);
    alert("❌ Erro ao comprimir os dados do processo.");
  } finally {
    hideLoader();
  }
}

function copyShareLinkToClipboard() {
  const inputEl = document.getElementById('shareLinkInput');
  inputEl.select();
  navigator.clipboard.writeText(inputEl.value).then(() => {
    alert("📋 Link de compartilhamento copiado com sucesso!");
    closeModal('shareLinkModal');
  }).catch(err => {
    alert("Não foi possível copiar automaticamente. Copie manualmente do campo de texto.");
  });
}

function hideLoader() {
  document.getElementById("globalLoader").classList.add("hidden");
}

// === CARREGAR / LISTAR PROCESSOS PUBLICADOS NO EDITOR ===
function supabaseReady() {
  return SUPABASE_CONFIG && SUPABASE_CONFIG.url &&
    !SUPABASE_CONFIG.url.includes('COLE_A_URL') &&
    SUPABASE_CONFIG.anonKey && !SUPABASE_CONFIG.anonKey.includes('COLE_SUA_ANON');
}

function escapeHtmlAttr(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function openExistingProcessModal() {
  document.getElementById('existingProcessModal').classList.remove('hidden');
  renderExistingProcessList();
}

async function renderExistingProcessList() {
  const listEl = document.getElementById('existingProcessList');
  if (!supabaseReady()) {
    listEl.innerHTML = '<div style="color:var(--text-muted,#64748b);font-size:13px;padding:12px;text-align:center;">Supabase nao configurado neste arquivo.</div>';
    return;
  }
  listEl.innerHTML = '<div style="color:var(--text-muted,#64748b);font-size:13px;padding:12px;text-align:center;">Carregando processos...</div>';
  try {
    const endpoint = `${SUPABASE_CONFIG.url.replace(/\/+$/, '')}/rest/v1/${SUPABASE_CONFIG.table}?select=slug,titulo,autor,updated_at&order=updated_at.desc`;
    const res = await fetch(endpoint, {
      headers: { apikey: SUPABASE_CONFIG.anonKey, Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}` }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = await res.json();
    if (!rows || rows.length === 0) {
      listEl.innerHTML = '<div style="color:var(--text-muted,#64748b);font-size:13px;padding:12px;text-align:center;">Nenhum processo publicado ainda.</div>';
      return;
    }
    listEl.innerHTML = rows.map(function (p) {
      const titulo = (p.titulo || p.slug || '(sem titulo)');
      const autor = p.autor ? ('Autor: ' + escapeHtmlAttr(p.autor) + ' | ') : '';
      const data = p.updated_at ? new Date(p.updated_at).toLocaleDateString('pt-BR') : '';
      const slugSafe = escapeHtmlAttr(p.slug);
      return '<button type="button" onclick="loadProcessFromSupabase(\'' + slugSafe + '\')" ' +
        'style="display:block;width:100%;text-align:left;padding:10px 12px;margin-bottom:8px;border:1px solid var(--border-color,#cbd5e1);border-radius:10px;background:var(--bg-secondary,#f8fafc);color:inherit;cursor:pointer;">' +
        '<span style="display:block;font-weight:600;">' + escapeHtmlAttr(titulo) + '</span>' +
        '<span style="display:block;font-size:12px;color:var(--text-muted,#64748b);margin-top:2px;">' + autor + slugSafe + (data ? ' | ' + data : '') + '</span>' +
        '</button>';
    }).join('');
  } catch (e) {
    listEl.innerHTML = '<div style="color:#ef4444;font-size:13px;padding:12px;text-align:center;">Erro ao carregar a lista: ' + (e.message || e) + '</div>';
  }
}

async function loadProcessFromSupabase(slug) {
  if (!supabaseReady()) { alert('Supabase nao configurado.'); return; }
  try {
    showLoader('Carregando processo...');
    const endpoint = `${SUPABASE_CONFIG.url.replace(/\/+$/, '')}/rest/v1/${SUPABASE_CONFIG.table}?slug=eq.${encodeURIComponent(slug)}&select=html,slug&limit=1`;
    const res = await fetch(endpoint, {
      headers: { apikey: SUPABASE_CONFIG.anonKey, Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}` }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = await res.json();
    if (!rows || rows.length === 0 || !rows[0].html) {
      alert('Processo nao encontrado no Supabase.');
      return;
    }
    const ok = applyProjectHTML(rows[0].html);
    if (!ok) return;
    window.currentPublishSlug = rows[0].slug || slug;
    closeModal('welcomeModal');
    if (document.getElementById('existingProcessModal')) closeModal('existingProcessModal');
    setTimeout(function () { initiateEditMode(); }, 300);
  } catch (e) {
    alert('Erro ao carregar o processo: ' + (e.message || e));
  } finally {
    hideLoader();
  }
}

// Abrir o editor ja carregando um processo publicado: index.html?edit=<slug>
window.addEventListener('load', function () {
  try {
    const params = new URLSearchParams(window.location.search);
    const editSlug = (params.get('edit') || '').trim();
    if (editSlug) {
      closeModal('welcomeModal');
      loadProcessFromSupabase(editSlug);
    }
  } catch (e) {}
});
