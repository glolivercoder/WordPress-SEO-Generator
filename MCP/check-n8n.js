const fetch = require('node-fetch');

const N8N_API_KEY = process.env.N8N_API_KEY || 'your-n8n-api-key';

async function checkN8N() {
    try {
        console.log('Checking N8N connection...');
        
        const response = await fetch('http://localhost:5678/api/v1/workflows', {
            headers: {
                'X-N8N-API-KEY': N8N_API_KEY
            }
        });

        if (!response.ok) {
            console.error('N8N is not responding correctly. Status:', response.status);
            const text = await response.text();
            console.error('Response:', text);
            return false;
        }

        const data = await response.json();
        console.log('N8N is running!');
        console.log('Available workflows:');
        data.data.forEach(workflow => {
            console.log(`- ${workflow.name} (ID: ${workflow.id})`);
        });
        return true;

    } catch (error) {
        console.error('Error connecting to N8N:', error.message);
        console.log('Make sure N8N is running on http://localhost:5678');
        return false;
    }
}

checkN8N().then(isRunning => {
    if (!isRunning) {
        console.log('\nTo start N8N, open a new terminal and run:');
        console.log('n8n start');
    }
});