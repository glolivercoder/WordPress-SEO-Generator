// Socket.io connection
const socket = io();

// Elements
const n8nStatus = document.getElementById('n8nStatus');
const workflowStatus = document.getElementById('workflowStatus');
const wordpressStatus = document.getElementById('wordpressStatus');
const toggleWorkflowBtn = document.getElementById('toggleWorkflowBtn');
const generateBtn = document.getElementById('generateBtn');
const generateStatus = document.getElementById('generateStatus');
const editBtn = document.getElementById('editBtn');
const publishBtn = document.getElementById('publishBtn');
const preview = document.getElementById('preview');
const logs = document.getElementById('logs');
const prompt = document.getElementById('prompt');

// API Keys elements
const n8nKey = document.getElementById('n8nKey');
const openaiKey = document.getElementById('openaiKey');
const perplexityKey = document.getElementById('perplexityKey');
const saveApiKeys = document.getElementById('saveApiKeys');

// WordPress elements
const wpUrl = document.getElementById('wpUrl');
const wpUsername = document.getElementById('wpUsername');
const wpPassword = document.getElementById('wpPassword');
const saveWpConfig = document.getElementById('saveWpConfig');

// Status tracking
let currentWorkflowId = null;
let isWorkflowActive = false;
let generatedContent = null;

// Função para adicionar logs com timestamp
function addLog(message, type = 'info') {
    const logEntry = document.createElement('div');
    const timestamp = new Date().toLocaleTimeString();
    
    let color = 'text-gray-600';
    if (type === 'error') color = 'text-red-500';
    if (type === 'success') color = 'text-green-500';

    logEntry.className = `${color} text-sm`;
    logEntry.textContent = `[${timestamp}] ${message}`;
    logs.insertBefore(logEntry, logs.firstChild);
}

// Save API Keys
saveApiKeys.addEventListener('click', async () => {
    try {
        saveApiKeys.disabled = true;
        saveApiKeys.textContent = 'Saving...';
        addLog('Updating API keys...', 'info');

        const response = await fetch('/api/update-apis', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                openaiKey: openaiKey.value,
                perplexityKey: perplexityKey.value
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to update API keys');
        }

        addLog('API keys updated successfully', 'success');

    } catch (error) {
        addLog(`Error: ${error.message}`, 'error');
    } finally {
        saveApiKeys.disabled = false;
        saveApiKeys.textContent = 'Save API Keys';
    }
});

// Save WordPress Config
saveWpConfig.addEventListener('click', async () => {
    try {
        saveWpConfig.disabled = true;
        saveWpConfig.textContent = 'Saving...';
        addLog('Updating WordPress settings...', 'info');

        const response = await fetch('/api/update-wordpress', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: wpUrl.value,
                username: wpUsername.value,
                password: wpPassword.value
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to update WordPress settings');
        }

        addLog('WordPress settings updated successfully', 'success');
        wordpressStatus.className = 'w-3 h-3 rounded-full bg-green-500 mr-2';

    } catch (error) {
        addLog(`Error: ${error.message}`, 'error');
        wordpressStatus.className = 'w-3 h-3 rounded-full bg-red-500 mr-2';
    } finally {
        saveWpConfig.disabled = false;
        saveWpConfig.textContent = 'Save WordPress Config';
    }
});

// Status do N8N
socket.on('n8nStatus', (status) => {
    const { connected, workflow } = status;
    
    n8nStatus.className = `w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} mr-2`;
    addLog(`N8N: ${connected ? 'Conectado' : 'Desconectado'}`, connected ? 'success' : 'error');

    if (workflow && workflow.exists) {
        workflowStatus.className = `w-3 h-3 rounded-full ${workflow.active ? 'bg-green-500' : 'bg-yellow-500'} mr-2`;
        generateBtn.disabled = !workflow.active;
        addLog(`Workflow ${workflow.id} ${workflow.active ? 'está ativo' : 'está inativo'}`, workflow.active ? 'success' : 'warning');
    } else {
        workflowStatus.className = 'w-3 h-3 rounded-full bg-red-500 mr-2';
        generateBtn.disabled = true;
        addLog('Workflow não encontrado', 'error');
    }
});

// Geração de conteúdo
generateBtn.addEventListener('click', async () => {
    if (!prompt.value.trim()) {
        addLog('Erro: Digite uma consulta de pesquisa', 'error');
        return;
    }

    try {
        generateBtn.disabled = true;
        generateStatus.classList.remove('hidden');
        generateStatus.classList.add('flex');
        addLog('Gerando conteúdo...', 'info');

        const response = await fetch('/api/execute-workflow', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt.value
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Falha ao gerar conteúdo');
        }

        preview.innerHTML = data.content || data.choices?.[0]?.message?.content || JSON.stringify(data, null, 2);
        addLog('Conteúdo gerado com sucesso', 'success');

    } catch (error) {
        addLog(`Erro: ${error.message}`, 'error');
        preview.innerHTML = '<p class="text-red-500">Erro ao gerar conteúdo. Tente novamente.</p>';
    } finally {
        generateBtn.disabled = false;
        generateStatus.classList.add('hidden');
        generateStatus.classList.remove('flex');
    }
});

// Edit functionality
editBtn.addEventListener('click', () => {
    if (editBtn.textContent === 'Edit') {
        preview.contentEditable = true;
        preview.focus();
        editBtn.textContent = 'Save';
        addLog('Editing content...', 'info');
        preview.classList.add('border-blue-500', 'border-2');
    } else {
        preview.contentEditable = false;
        editBtn.textContent = 'Edit';
        addLog('Content saved', 'success');
        preview.classList.remove('border-blue-500', 'border-2');
        generatedContent = { content: preview.innerHTML };
    }
});

// Publish functionality
publishBtn.addEventListener('click', async () => {
    if (!generatedContent) {
        addLog('Error: No content to publish', 'error');
        return;
    }

    try {
        publishBtn.disabled = true;
        publishBtn.textContent = 'Publishing...';
        addLog('Publishing to WordPress...', 'info');

        const content = preview.innerHTML;
        const title = content.split('\n')[0].replace(/<[^>]*>/g, '');

        const response = await fetch('/api/update-wordpress', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title,
                content: content,
                status: 'draft'
            })
        });

        if (!response.ok) {
            throw new Error('Failed to publish content');
        }

        addLog('Content published successfully to WordPress', 'success');
        
    } catch (error) {
        addLog(`Error: ${error.message}`, 'error');
    } finally {
        publishBtn.disabled = false;
        publishBtn.textContent = 'Publish to WordPress';
    }
});

// Load saved configurations from localStorage
document.addEventListener('DOMContentLoaded', () => {
    const inputs = {
        openaiKey: localStorage.getItem('openaiKey'),
        perplexityKey: localStorage.getItem('perplexityKey'),
        wpUrl: localStorage.getItem('wpUrl'),
        wpUsername: localStorage.getItem('wpUsername'),
        wpPassword: localStorage.getItem('wpPassword')
    };

    Object.entries(inputs).forEach(([key, value]) => {
        const input = document.getElementById(key);
        if (input && value) {
            input.value = value;
            input.addEventListener('change', () => {
                localStorage.setItem(key, input.value);
            });
        }
    });
});