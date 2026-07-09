// === GESTÃO DO JSON E CREDENCIAIS ===
function getProjectMeta() {
    try { return JSON.parse(document.getElementById('project-credentials').textContent); } 
    catch(e) { return { isSet: false, user: "", pass: "" }; }
}

function setProjectMeta(meta) {
    document.getElementById('project-credentials').textContent = JSON.stringify(meta);
}

// === CONTROLES GERAIS E INICIALIZAÇÃO ===
document.addEventListener('DOMContentLoaded', async () => {
  const isNew = document.body.getAttribute('data-is-new');
  if (isNew !== 'false') {
      document.getElementById('welcomeModal').classList.remove('hidden');
  }

  initTabNavigation();
  initProgressSystem();
  
  const savedThemePref = localStorage.getItem('sgd_faq_theme_pref');
  const checkbox = document.getElementById('themeToggleCheckbox');
  
  if (savedThemePref === 'dark-tech' || checkbox.hasAttribute('checked')) {
    document.body.classList.add('theme-dark-tech');
    checkbox.checked = true;
  } else {
    document.body.classList.remove('theme-dark-tech');
    checkbox.checked = false;
  }
  
  const btn = document.getElementById('toggle-all-btn');
  if (btn) btn.textContent = "Recolher Tudo";
  
  switchTab('sec-1', true);

  // Verifica se há dados na URL para carregamento instantâneo
  const hash = window.location.hash;
  if (hash && hash.startsWith('#data=')) {
    const compressedData = hash.substring(6);
    try {
      if (typeof showLoader === 'function') showLoader("Carregando processo do link...");
      const dataJSON = await decompressData(compressedData);
      await loadDataFromJSON(dataJSON);
      document.body.setAttribute('data-is-new', 'false');
      closeModal('welcomeModal');
    } catch (e) {
      console.error("Erro ao carregar dados do link:", e);
      alert("❌ Erro ao descompactar os dados do link. Certifique-se de que o link está completo.");
    } finally {
      if (typeof hideLoader === 'function') hideLoader();
    }
  }
});

function startNewProject() {
    closeModal('welcomeModal');
    initiateEditMode(); 
}

function importProject(event) {
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const htmlContent = e.target.result;
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        
        const newFaqContainer = doc.getElementById('faqContainer');
        const newTocList = doc.getElementById('tocList');
        const newTitle = doc.getElementById('editable-main-title');
        const newSubtitle = doc.getElementById('editable-main-subtitle');
        const newCreds = doc.getElementById('project-credentials');
        
        if (!newFaqContainer || !newTocList) {
            alert("Erro: O arquivo selecionado não é um projeto válido deste Gerador.");
            document.getElementById('importFileInput').value = '';
            return;
        }

        document.getElementById('faqContainer').innerHTML = newFaqContainer.innerHTML;
        document.getElementById('tocList').innerHTML = newTocList.innerHTML;
        
        if(newTitle) document.getElementById('editable-main-title').innerHTML = newTitle.innerHTML;
        if(newSubtitle) document.getElementById('editable-main-subtitle').innerHTML = newSubtitle.innerHTML;
        if(newCreds) document.getElementById('project-credentials').textContent = newCreds.textContent;
        
        document.body.setAttribute('data-is-new', 'false');
        closeModal('welcomeModal');
        
        cleanupAdminUI();
        updateSectionFooters();
        updateTOCCounters();
        
        const firstTab = document.querySelector('.section');
        if(firstTab) switchTab(firstTab.id, true);
        
        document.getElementById('importFileInput').value = '';

        setTimeout(() => { initiateEditMode(); }, 300);
    };
    reader.readAsText(file);
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// === RECOLHER/EXPANDIR TUDO ===
let isAllExpanded = true;
function toggleAllState() {
  isAllExpanded = !isAllExpanded;
  const btn = document.getElementById('toggle-all-btn');
  btn.textContent = isAllExpanded ? "Recolher Tudo" : "Expandir Tudo";
  let container = document.body.classList.contains('search-active') ? document : document.querySelector('.section.active-tab');
  if(container) {
      container.querySelectorAll('details.faq-item').forEach(detail => {
        if (!detail.classList.contains('hidden')) {
          if (isAllExpanded) { detail.setAttribute('open', ''); } else { detail.removeAttribute('open'); }
        }
      });
  }
}

function uncheckSectionProgress(secId) {
    const section = document.getElementById(secId);
    if (!section) return;
    const checkboxes = section.querySelectorAll('.q-checkbox.checked');
    if(checkboxes.length === 0) return;

    let readItems = JSON.parse(localStorage.getItem('sgd_faq_progress') || '[]');
    checkboxes.forEach(cb => {
        const itemId = cb.closest('.faq-item').id;
        cb.classList.remove('checked');
        readItems = readItems.filter(id => id !== itemId);
    });
    localStorage.setItem('sgd_faq_progress', JSON.stringify(readItems));
    updateOverallProgress();
}

// Acordeão Inteligente e marcação como lido
document.addEventListener('click', function(e) {
    const summary = e.target.closest('summary');
    if (!summary) return;
    if (e.target.classList.contains('q-checkbox') || e.target.closest('.admin-element-controls')) return;
    
    const details = summary.parentElement;
    if (!details.hasAttribute('open')) {
        const section = details.closest('.section');
        if (section) {
            const currentlyOpen = section.querySelector('details.faq-item[open]');
            if (currentlyOpen && currentlyOpen !== details) {
                currentlyOpen.removeAttribute('open');
                checkItemAsRead(currentlyOpen);
            }
        }
        setTimeout(() => {
            const yOffset = -40; 
            const y = details.getBoundingClientRect().top + window.scrollY + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }, 60);
    } else {
        checkItemAsRead(details);
    }
});

function checkItemAsRead(item) {
    const checkbox = item.querySelector('.q-checkbox');
    if (checkbox && !checkbox.classList.contains('checked')) {
        checkbox.classList.add('checked');
        let readItems = JSON.parse(localStorage.getItem('sgd_faq_progress') || '[]');
        if (!readItems.includes(item.id)) {
            readItems.push(item.id);
            localStorage.setItem('sgd_faq_progress', JSON.stringify(readItems));
            updateOverallProgress();
        }
    }
}

// === BUSCA GLOBAL ===
function filterFAQ() {
  const input = document.getElementById('searchInput');
  const textFilter = input.value.toLowerCase();
  const items = document.querySelectorAll('.faq-item');
  
  if (textFilter.length > 0) { document.body.classList.add('search-active'); } 
  else { document.body.classList.remove('search-active'); }

  items.forEach(item => {
    const text = item.innerText.toLowerCase();
    if (text.includes(textFilter)) { item.classList.remove('hidden'); } 
    else { item.classList.add('hidden'); }
  });
  
  const sections = document.querySelectorAll('.section');
  sections.forEach(sec => {
    const visibleItems = sec.querySelectorAll('.faq-item:not(.hidden)');
    if (textFilter.length > 0) {
       if (visibleItems.length > 0) { sec.classList.add('has-results'); } 
       else { sec.classList.remove('has-results'); }
    } else { sec.classList.remove('has-results'); }
  });

  if (textFilter.length > 0) {
    document.querySelectorAll('details.faq-item:not(.hidden)').forEach(d => d.setAttribute('open', ''));
  } else {
    document.querySelectorAll('details.faq-item').forEach(d => d.removeAttribute('open'));
    const activeSection = document.querySelector('.section.active-tab');
    if(activeSection) {
        const firstItem = activeSection.querySelector('details.faq-item');
        if(firstItem) firstItem.setAttribute('open', '');
    }
  }
  updateTOCCounters();
}

// === SISTEMA DE PROGRESSO ===
function initProgressSystem() {
  const items = document.querySelectorAll('.faq-item');
  let readItems = JSON.parse(localStorage.getItem('sgd_faq_progress') || '[]');
  items.forEach(item => {
    const checkbox = item.querySelector('.q-checkbox');
    if (checkbox && readItems.includes(item.id)) { checkbox.classList.add('checked'); }
  });
  updateOverallProgress();
}

function toggleProgress(id, event) {
  if(event) { event.preventDefault(); event.stopPropagation(); }
  const checkbox = document.getElementById(id).querySelector('.q-checkbox');
  if (!checkbox) return;
  let readItems = JSON.parse(localStorage.getItem('sgd_faq_progress') || '[]');
  if (checkbox.classList.contains('checked')) {
    checkbox.classList.remove('checked');
    readItems = readItems.filter(item => item !== id);
  } else {
    checkbox.classList.add('checked');
    if (!readItems.includes(id)) readItems.push(id);
  }
  localStorage.setItem('sgd_faq_progress', JSON.stringify(readItems));
  updateOverallProgress();
}

function updateOverallProgress() {
  const items = document.querySelectorAll('.faq-item');
  const totalQuestions = items.length;
  let readItems = JSON.parse(localStorage.getItem('sgd_faq_progress') || '[]');
  const validIds = Array.from(items).map(item => item.id);
  
  readItems = readItems.filter(id => validIds.includes(id));
  localStorage.setItem('sgd_faq_progress', JSON.stringify(readItems));

  const checkedCount = document.querySelectorAll('.q-checkbox.checked').length;
  const percentage = totalQuestions > 0 ? Math.round((checkedCount / totalQuestions) * 100) : 0;
  
  const bar = document.getElementById('readingProgress');
  const label = document.getElementById('progressLabel');
  
  if(bar) bar.style.width = percentage + "%";
  if(label) label.textContent = `Progresso de leitura: ${percentage}% (${checkedCount} de ${totalQuestions} dominados)`;
  updateTOCCounters();
}

function updateTOCCounters() {
  const sections = document.querySelectorAll('.section');
  sections.forEach(sec => {
    const secId = sec.id;
    const totalItems = sec.querySelectorAll('.faq-item').length;
    const readCount = sec.querySelectorAll('.q-checkbox.checked').length;
    const tocLink = document.querySelector(`.toc a[href="#${secId}"]`);
    
    if (tocLink) {
      const liParent = tocLink.closest('li');
      let badge = tocLink.querySelector('.toc-counter');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'toc-counter';
        tocLink.appendChild(badge);
      }
      badge.textContent = `${readCount}/${totalItems}`;
      liParent.classList.remove('completed-toc-node', 'partial-toc-node');
      if (totalItems > 0 && readCount === totalItems) { liParent.classList.add('completed-toc-node'); } 
      else if (readCount > 0 && readCount < totalItems) { liParent.classList.add('partial-toc-node'); }
    }
  });
}

// === NAVEGAÇÃO POR ABAS ===
function initTabNavigation() {
  document.querySelector('.toc').addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    const targetId = link.getAttribute('href').replace('#', '');
    if (targetId.startsWith('sec-')) {
      e.preventDefault();
      const searchInput = document.getElementById('searchInput');
      if(searchInput && searchInput.value.length > 0) {
        searchInput.value = ''; filterFAQ();
      }
      
      const currentActiveSec = document.querySelector('.section.active-tab');
      if (currentActiveSec) {
          const items = currentActiveSec.querySelectorAll('details.faq-item');
          if (items.length > 0) {
              const lastItem = items[items.length - 1];
              if (lastItem.hasAttribute('open')) checkItemAsRead(lastItem);
          }
      }
      switchTab(targetId);
    }
  });
}

function switchTab(tabId, isAutoLoad = false) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active-tab'));
  document.querySelectorAll('.toc li').forEach(li => li.classList.remove('active-toc-node'));
  
  const targetSection = document.getElementById(tabId);
  if (targetSection) {
      targetSection.classList.add('active-tab');
      targetSection.querySelectorAll('details.faq-item').forEach(d => d.removeAttribute('open'));
      const firstItem = targetSection.querySelector('details.faq-item');
      if(firstItem) firstItem.setAttribute('open', '');

      if (!isAutoLoad) {
          setTimeout(() => {
              const yOffset = targetSection.getBoundingClientRect().top + window.scrollY - 30; 
              window.scrollTo({ top: yOffset, behavior: 'smooth' });
          }, 50);
      }
  }
  const tocLink = document.querySelector(`.toc a[href="#${tabId}"]`);
  if (tocLink) tocLink.closest('li').classList.add('active-toc-node');
  updateSectionFooters();
}

function updateSectionFooters() {
    const sections = document.querySelectorAll('.section');
    sections.forEach((sec, index) => {
        const footerBtn = sec.querySelector('.section-nav-footer .btn');
        if (footerBtn) {
            if (index === sections.length - 1) {
                footerBtn.innerHTML = '↺ Marcar como Lido e Voltar ao Início';
                footerBtn.className = 'btn btn-outline';
            } else {
                footerBtn.innerHTML = '✓ Marcar como Lido e Ir para Próxima ↓';
                footerBtn.className = 'btn';
            }
        }
    });
}

function goToNextSection(btnEl) {
  const currentSec = btnEl.closest('.section');
  if (currentSec) {
    const unreadItems = currentSec.querySelectorAll('.faq-item');
    let readItems = JSON.parse(localStorage.getItem('sgd_faq_progress') || '[]');

    unreadItems.forEach(item => {
      const checkbox = item.querySelector('.q-checkbox');
      if (checkbox && !checkbox.classList.contains('checked')) {
        checkbox.classList.add('checked');
        if (!readItems.includes(item.id)) readItems.push(item.id);
      }
    });

    localStorage.setItem('sgd_faq_progress', JSON.stringify(readItems));
    updateOverallProgress();
    
    const sections = Array.from(document.querySelectorAll('.section'));
    const currentIndex = sections.indexOf(currentSec);
    let nextSecId = null;
    
    if (currentIndex > -1 && currentIndex < sections.length - 1) { nextSecId = sections[currentIndex + 1].id; } 
    else if (sections.length > 0) { nextSecId = sections[0].id; }

    if (nextSecId) { switchTab(nextSecId); }
  }
}

// === TEMA E AUXILIARES ===
function initKeyboardTester() {
  window.addEventListener('keydown', (e) => {
    const sec1 = document.getElementById('sec-1');
    if (!sec1 || !sec1.classList.contains('active-tab')) return;
    
    let rowTarget = null;
    const key = e.key.toLowerCase();
    
    if (e.ctrlKey && key === 'b') { e.preventDefault(); rowTarget = document.querySelector('tr[data-shortcut="b"]'); }
    if (e.ctrlKey && key === 'i') { e.preventDefault(); rowTarget = document.querySelector('tr[data-shortcut="i"]'); }
    if (e.ctrlKey && key === 'u') { e.preventDefault(); rowTarget = document.querySelector('tr[data-shortcut="u"]'); }
    if (e.ctrlKey && key === 'm') { e.preventDefault(); rowTarget = document.querySelector('tr[data-shortcut="m"]'); }
    if (e.altKey && e.shiftKey && key === 'u') { e.preventDefault(); rowTarget = document.querySelector('tr[data-shortcut="alt-shift-u"]'); }
    if (e.ctrlKey && e.altKey && key === 't') { e.preventDefault(); rowTarget = document.querySelector('tr[data-shortcut="t"]'); }
    
    if (rowTarget) {
      rowTarget.classList.remove('pulsing-shortcut');
      void rowTarget.offsetWidth;
      rowTarget.classList.add('pulsing-shortcut');
    }
  });
}

function toggleThemeWithPill() {
  const checkbox = document.getElementById('themeToggleCheckbox');
  if (checkbox.checked) {
    document.body.classList.add('theme-dark-tech');
    localStorage.setItem('sgd_faq_theme_pref', 'dark-tech');
  } else {
    document.body.classList.remove('theme-dark-tech');
    localStorage.setItem('sgd_faq_theme_pref', 'classic-slate');
  }
}

window.addEventListener('scroll', () => {
  const btn = document.getElementById('scroll-to-top-btn');
  if (window.scrollY > 300) { btn.classList.remove('hidden'); } 
  else { btn.classList.add('hidden'); }
});

function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

// === COMPRESSÃO, DESCOMPRESSÃO E CARREGAMENTO DE LINK (SEM SERVIDOR) ===
async function compressData(str) {
  const stream = new Blob([str]).stream();
  const compressedStream = stream.pipeThrough(new CompressionStream('deflate'));
  const chunks = [];
  const reader = compressedStream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const compressedBlob = new Blob(chunks);
  const buffer = await compressedBlob.arrayBuffer();
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function decompressData(base64str) {
  let base64 = base64str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const stream = new Blob([bytes]).stream();
  const decompressedStream = stream.pipeThrough(new DecompressionStream('deflate'));
  const chunks = [];
  const reader = decompressedStream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const blob = new Blob(chunks);
  return await blob.text();
}

async function loadDataFromJSON(dataJSON) {
  const data = JSON.parse(dataJSON);
  
  // 1. Atualiza títulos
  document.getElementById('editable-main-title').textContent = data.title;
  document.getElementById('editable-main-subtitle').textContent = data.subtitle;
  
  // 2. Limpa TOC e Container
  const tocList = document.getElementById('tocList');
  const faqContainer = document.getElementById('faqContainer');
  tocList.innerHTML = '';
  faqContainer.querySelectorAll('.section, .admin-add-section-btn').forEach(el => el.remove());
  
  // 3. Reconstrói
  data.sections.forEach((sec, sIdx) => {
    const li = document.createElement('li');
    if (sIdx === 0) li.className = 'active-toc-node';
    li.innerHTML = `<a href="#${sec.id}"><span class="toc-text">${sec.title}</span></a>`;
    tocList.appendChild(li);
    
    const sectionEl = document.createElement('section');
    sectionEl.className = `section ${sIdx === 0 ? 'active-tab' : ''}`;
    sectionEl.id = sec.id;
    
    let faqHtmls = sec.faqs.map(faq => `
      <details class="q faq-item" id="${faq.id}">
        <summary>
          <span class="sumLeft">
            <span class="q-checkbox" onclick="toggleProgress('${faq.id}', event)"></span>
            <span class="qText">${faq.title}</span>
          </span>
          <span class="chev">▼</span>
        </summary>
        <div class="a">${faq.answer}</div>
      </details>
    `).join('');
    
    sectionEl.innerHTML = `
      <div class="sectionHeader">
        <h2 class="secTitle" contenteditable="false" data-sync-bound="true">${sec.title}</h2>
        <div class="header-actions">
            <button class="btn btn-outline btn-unmark-all" onclick="uncheckSectionProgress('${sec.id}')">↺ Desmarcar Todos</button>
        </div>
      </div>
      ${faqHtmls}
      <div class="section-nav-footer">
        <button class="btn" onclick="goToNextSection(this)"></button>
      </div>
    `;
    
    faqContainer.appendChild(sectionEl);
  });
  
  // 4. Re-inicializa listeners e sistemas
  initTabNavigation();
  initProgressSystem();
  updateSectionFooters();
  updateTOCCounters();
  
  if (typeof isEditMode !== 'undefined' && isEditMode) {
    enableAdminMode();
  }
}

window.addEventListener('hashchange', async () => {
  const hash = window.location.hash;
  if (hash && hash.startsWith('#data=')) {
    const compressedData = hash.substring(6);
    try {
      if (typeof showLoader === 'function') showLoader("Carregando processo...");
      const dataJSON = await decompressData(compressedData);
      await loadDataFromJSON(dataJSON);
    } catch (e) {
      console.error("Erro no hashchange:", e);
    } finally {
      if (typeof hideLoader === 'function') hideLoader();
    }
  }
});
