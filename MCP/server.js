const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const workflowTemplate = require('./workflow-template.json');

let CURRENT_WORKFLOW = null;
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiOWU2YWNlYi00NTE0LTQxMjktOWM0My04ZGY4ZjIzMTkyZTkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzQzMjA0MDM5fQ._3oUdJcOh3IVST1XXtu-enlcxiChCTE5hNcGptxEsJE';
const TARGET_WORKFLOW_ID = 'A7pxOsfdE3YxRC25';

// Credenciais
const CREDENTIALS = {
    wordpress: {
        username: 'gloliverx',
        password: 'LHyY s9Gf a1ty STgf IrS2 ZUKZ',
        url: 'https://atitudesport.com.br/afiliadoamz'
    },
    apis: {
        n8n: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiOWU2YWNlYi00NTE0LTQxMjktOWM0My04ZGY4ZjIzMTkyZTkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzQzMjA0MDM5fQ._3oUdJcOh3IVST1XXtu-enlcxiChCTE5hNcGptxEsJE',
        openai: 'R0gW80yTfsrAp3UX8Bzl9WjBHiGitCyJ',
        google: 'AIzaSyD7bbOPh0BVjPISXAdHM5djJc-tLU0dmi8',
        deepseek: 'sk-eb357d575853453ca118bd1dd77c72c6'
    }
};

app.use(express.static('public'));
app.use(express.json());

// Add execute-workflow endpoint
app.post('/api/execute-workflow', async (req, res) => {
    try {
        if (!CURRENT_WORKFLOW || !CURRENT_WORKFLOW.active) {
            throw new Error('Workflow não está ativo');
        }

        const { prompt } = req.body;
        if (!prompt) {
            throw new Error('Prompt é obrigatório');
        }

        console.log('Executando workflow com prompt:', prompt);

        // Use the webhook URL from the form trigger node
        const webhookUrl = 'http://localhost:5678/webhook/a29cbcd3-9d11-4f7c-9aad-14681c356c53';
        console.log('Chamando webhook:', webhookUrl);

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                'Research Query': prompt
            })
        });

        console.log('Status da resposta:', response.status);
        const responseText = await response.text();
        console.log('Resposta do webhook:', responseText);

        if (!response.ok) {
            throw new Error(`Falha ao executar workflow: ${responseText}`);
        }

        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            console.log('Resposta não é JSON válido, retornando texto bruto');
            result = { content: responseText };
        }

        res.json(result);

    } catch (error) {
        console.error('Erro na execução:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add WordPress update endpoint
app.post('/api/update-wordpress', async (req, res) => {
    try {
        const { title, content, status = 'draft' } = req.body;
        
        if (!title || !content) {
            throw new Error('Título e conteúdo são obrigatórios');
        }

        const response = await fetch(`${CREDENTIALS.wordpress.url}/wp-json/wp/v2/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + Buffer.from(`${CREDENTIALS.wordpress.username}:${CREDENTIALS.wordpress.password}`).toString('base64')
            },
            body: JSON.stringify({
                title,
                content,
                status
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Falha ao publicar no WordPress: ${error}`);
        }

        const result = await response.json();
        res.json(result);

    } catch (error) {
        console.error('Erro ao publicar:', error);
        res.status(500).json({ error: error.message });
    }
});

async function updateWorkflowCredentials() {
    try {
        console.log('Atualizando credenciais do workflow...');
        
        // Verificar se o workflow está inicializado
        if (!CURRENT_WORKFLOW) {
            CURRENT_WORKFLOW = await initializeWorkflow();
        }

        const updatedNodes = CURRENT_WORKFLOW.nodes.map(node => {
            // Configurar WordPress
            if (node.type === 'n8n-nodes-base.wordpress') {
                node.parameters = {
                    ...node.parameters,
                    url: CREDENTIALS.wordpress.url,
                    authentication: 'basicAuth',
                    username: CREDENTIALS.wordpress.username,
                    password: CREDENTIALS.wordpress.password
                };
            }

            // Configurar OpenAI
            if (node.type === 'n8n-nodes-base.openAi') {
                node.parameters = {
                    ...node.parameters,
                    apiKey: CREDENTIALS.apis.openai
                };
            }

            // Configurar Google API
            if (node.type === 'n8n-nodes-base.googleApi') {
                node.parameters = {
                    ...node.parameters,
                    apiKey: CREDENTIALS.apis.google
                };
            }

            return node;
        });

        const response = await fetch(`http://localhost:5678/api/v1/workflows/${CURRENT_WORKFLOW.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-N8N-API-KEY': N8N_API_KEY
            },
            body: JSON.stringify({ ...CURRENT_WORKFLOW, nodes: updatedNodes })
        });

        if (!response.ok) {
            throw new Error('Falha ao atualizar credenciais do workflow');
        }

        CURRENT_WORKFLOW = await response.json();
        console.log('Credenciais atualizadas com sucesso');
        return true;

    } catch (error) {
        console.error('Erro ao atualizar credenciais:', error);
        return false;
    }
}

async function updateWorkflowNodes() {
    try {
        console.log('Atualizando nós do workflow...');
        
        const updatedNodes = CURRENT_WORKFLOW.nodes.map(node => {
            if (node.name === "Upload Image to Wordpress" || node.name === "Set Image on Wordpress Post") {
                node.parameters.url = node.parameters.url.replace('commonclone.com', 'atitudesport.com.br/afiliadoamz');
                node.parameters.authentication = 'basicAuth';
                node.credentials = {
                    basicAuth: {
                        username: CREDENTIALS.wordpress.username,
                        password: CREDENTIALS.wordpress.password
                    }
                };
            }

            if (node.name === "Wordpress") {
                node.parameters.url = CREDENTIALS.wordpress.url;
                node.parameters.authentication = 'basicAuth';
                node.credentials = {
                    basicAuth: {
                        username: CREDENTIALS.wordpress.username,
                        password: CREDENTIALS.wordpress.password
                    }
                };
            }

            if (node.name === "OpenAI Content Generation") {
                node.parameters.headerParameters.parameters = node.parameters.headerParameters.parameters.map(param => {
                    if (param.name === "Authorization") {
                        return { ...param, value: `Bearer ${CREDENTIALS.apis.openai}` };
                    }
                    return param;
                });
            }

            if (node.name === "Perplexity Research") {
                node.parameters.headerParameters.parameters = node.parameters.headerParameters.parameters.map(param => {
                    if (param.name === "Authorization") {
                        return { ...param, value: `Bearer ${CREDENTIALS.apis.deepseek}` };
                    }
                    return param;
                });
            }

            return node;
        });

        const response = await fetch(`http://localhost:5678/api/v1/workflows/${CURRENT_WORKFLOW.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-N8N-API-KEY': N8N_API_KEY
            },
            body: JSON.stringify({ ...CURRENT_WORKFLOW, nodes: updatedNodes })
        });

        if (!response.ok) {
            throw new Error('Falha ao atualizar nós do workflow');
        }

        CURRENT_WORKFLOW = await response.json();
        console.log('Nós do workflow atualizados com sucesso');
        return true;

    } catch (error) {
        console.error('Erro ao atualizar nós:', error);
        return false;
    }
}

async function initializeWorkflow() {
    try {
        console.log('Iniciando verificação do N8N...');
        
        const testResponse = await fetch('http://localhost:5678/api/v1/workflows', {
            headers: { 'X-N8N-API-KEY': N8N_API_KEY }
        });

        if (!testResponse.ok) {
            throw new Error(`N8N não está acessível: ${testResponse.statusText}`);
        }

        const workflows = await testResponse.json();
        console.log(`Workflows encontrados: ${workflows.data.length}`);

        // Procura pelo workflow específico
        CURRENT_WORKFLOW = workflows.data.find(w => w.id === TARGET_WORKFLOW_ID);
        
        if (!CURRENT_WORKFLOW) {
            throw new Error(`Workflow ${TARGET_WORKFLOW_ID} não encontrado`);
        }

        console.log(`Workflow encontrado: ${CURRENT_WORKFLOW.name}`);

        // Ativa o workflow se estiver inativo
        if (!CURRENT_WORKFLOW.active) {
            console.log('Ativando workflow...');
            const activateResponse = await fetch(`http://localhost:5678/api/v1/workflows/${CURRENT_WORKFLOW.id}/activate`, {
                method: 'POST',
                headers: { 'X-N8N-API-KEY': N8N_API_KEY }
            });

            if (!activateResponse.ok) {
                const error = await activateResponse.text();
                throw new Error(`Falha ao ativar workflow: ${error}`);
            }
            
            console.log('Workflow ativado com sucesso');
            CURRENT_WORKFLOW.active = true;
        } else {
            console.log('Workflow já está ativo');
        }

        // Atualizar credenciais do workflow
        if (CURRENT_WORKFLOW.active) {
            await updateWorkflowCredentials();
            await updateWorkflowNodes();
        }

        return CURRENT_WORKFLOW;

    } catch (error) {
        console.error('Erro ao inicializar workflow:', error);
        throw error;
    }
}

io.on('connection', async (socket) => {
    console.log('Client connected');
    
    try {
        if (!CURRENT_WORKFLOW) {
            CURRENT_WORKFLOW = await initializeWorkflow();
        }
        
        io.emit('n8nStatus', {
            connected: true,
            workflow: CURRENT_WORKFLOW ? {
                exists: true,
                active: true,
                id: CURRENT_WORKFLOW.id
            } : {
                exists: false,
                active: false,
                id: null
            }
        });
    } catch (error) {
        console.error('Socket connection error:', error);
    }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    try {
        CURRENT_WORKFLOW = await initializeWorkflow();
    } catch (error) {
        console.error('Server initialization error:', error);
    }
});