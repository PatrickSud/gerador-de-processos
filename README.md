# ⚙️ Gerador de Processos Interativo

Uma solução de **CMS Local (Content Management System)** de alta performance encapsulada em um único arquivo HTML. 

Nascido da evolução das lógicas do *SGD Editor de Texto Aprimorado*, este projeto elimina a necessidade de servidores ou bancos de dados complexos. Ele atua simultaneamente como um poderoso **Editor WYSIWYG** (What You See Is What You Get) para os criadores e um **Aplicativo de Leitura Interativo** para os usuários finais.

---

## ✨ Principais Funcionalidades

### Para quem Cria (Modo Administrador)
* **Arquitetura Zero-Config:** Todo o conteúdo, estilos e lógicas são embarcados no próprio `.html`. 
* **Barra de Formatação Avançada:** Textos (negrito, itálico, sublinhado, cores e alinhamentos), listas e Markdown dinâmico.
* **Mídias Inteligentes:** Incorporação de links do YouTube via *Smart Cards* e conversão automática de imagens locais para **Base64** nativo. As imagens viajam dentro do código!
* **Anotações (Callouts):** Criação de caixas de destaque coloridas (Dicas, Alertas, Perigos) com *Live Preview*.
* **Organização Drag and Drop:** Reordene seções e tópicos dinamicamente arrastando os elementos pelo Menu Lateral.
* **Histórico de Versões (Undo/Redo):** Proteção contra falhas com atalhos nativos (`Ctrl+Z` e `Ctrl+Y`) para desfazer e refazer ações no DOM.
* **Exportação Nativa:** Compile e baixe o projeto atualizado e criptografado com um único clique.

### Para quem Lê (Experiência do Usuário Final)
* **Acordeão Inteligente e Gamificado:** A navegação rastreia o progresso do usuário. Ao finalizar um tópico, o sistema o marca como lido e atualiza a trilha de progresso no topo da página.
* **Pesquisa Global (Real-time):** Filtro inteligente de palavras-chave que varre todas as abas e expande automaticamente os tópicos correspondentes.
* **Acessibilidade:** Suporte nativo à alternância entre o Tema Claro Clássico e o Tema Escuro de alta visibilidade.
* **Rolagem Dinâmica:** Navegação fluida com ancoragem visual para manter o foco na leitura.

---

## 🚀 Como Iniciar

1. Baixe ou clone o repositório.
2. Abra o arquivo principal (ex: `FAQ.html`) em qualquer navegador moderno.
3. Se for um **Novo Projeto**, clique no botão **Iniciar Novo Projeto** no modal de boas-vindas. O modo de edição já estará ativado.
4. Digite, formate, insira imagens e crie suas seções.
5. Ao concluir, clique em **📦 Exportar (.html)** no rodapé de edição. O sistema pedirá que você crie uma senha de proteção para futuras edições daquele manual gerado.

### Como editar um projeto já exportado?
Abra a versão base do Gerador, clique em **Editar Projeto Existente** no modal de boas-vindas e faça o upload do arquivo `.html` gerado anteriormente. O sistema irá reconstruir o projeto na tela e solicitar a senha original do criador para liberar os painéis de edição.

---

## 💻 Tecnologias Utilizadas

* **HTML5** e **CSS3** puros, com uso massivo de variáveis nativas (Custom Properties) para troca de temas.
* **Vanilla JavaScript** (ES6+): APIs nativas de `FileReader`, `DOMParser` para importação de projetos e `Selection/Range` para o editor de texto integrado.

---

> Desenvolvido e mantido por **Patrick Godoy**.
