const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const app = express();

// Configuração do Banco de Dados
const pool = new Pool({
  connectionString: 'postgres://postgres:UPc5N5qhQi9MyRKpCzBMBzRZu11Qdo7FoujsG2xlLlf15QrPC2X7fdah1IK2ovX7@187.77.53.190:5432/postgres?sslmode=disable',
  connectionTimeoutMillis: 5000
});

// ADICIONE ESTAS LINHAS LOGO ABAIXO DA CRIAÇÃO DO POOL
//pool.on('connect', (client) => {
//    client.query('SET search_path TO controle_tarefas, public');
//});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuração das Views (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- ROTAS DE DIAGNÓSTICO ---

// 1. Rota Raiz (Para testar se o domínio aponta pro lugar certo)
app.get('/', (req, res) => {
    res.send('<h1>🚀 Nexus Task Server Online!</h1><p>Para ver o dashboard, acesse: <b>/dashboard/SEU_ID_DA_ORGA</b></p>');
});

// 2. Rota de Status do Banco (Para testar se a conexão externa está funcionando)
app.get('/db-test', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() as timing');
        res.json({ status: 'Conectado ao Postgres!', time: result.rows[0].timing });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao conectar no banco', details: err.message });
    }
});

// --- ROTAS DO SISTEMA (SaaS) ---

// 3. Dashboard Principal com Multi-tenancy
app.get('/dashboard/:orgId', async (req, res) => {
    const { orgId } = req.params;
    
    // Regex para validar se o orgId é um UUID válido (opcional, mas evita erros de SQL)
    try {
        const orgRes = await pool.query('SELECT name FROM organizations WHERE id = $1', [orgId]);
        
        if (orgRes.rows.length === 0) {
            return res.status(404).send(`<h1>Organização não encontrada</h1><p>O ID <b>${orgId}</b> não existe no banco de dados.</p>`);
        }

        const tasksRes = await pool.query('SELECT * FROM tasks WHERE org_id = $1 ORDER BY created_at DESC', [orgId]);
        
        res.render('dashboard', { 
            tasks: tasksRes.rows, 
            orgName: orgRes.rows[0].name,
            orgId: orgId 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send(`<h1>Erro Interno</h1><p>${err.message}</p>`);
    }
});

// 4. API de Time Tracking
app.post('/api/timer', async (req, res) => {
    const { taskId, userId, action } = req.body;
    try {
        if (action === 'start') {
            // Usando o caminho completo: schema.tabela
            await pool.query(
                'INSERT INTO controle_tarefas.time_entries (task_id, user_id, start_time) VALUES ($1, $2, NOW())', 
                [taskId, userId]
            );
        } else {
            await pool.query(
                'UPDATE controle_tarefas.time_entries SET end_time = NOW() WHERE task_id = $1 AND end_time IS NULL', 
                [taskId]
            );
        }
        res.json({ success: true });
    } catch (err) {
        console.error("ERRO NO BANCO:", err.message); // Isso vai forçar o erro a aparecer no log do Coolify
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- FALLBACK ---
app.use((req, res) => {
    res.status(404).send(`<h1>404 - Rota inexistente</h1><p>Você tentou acessar: <b>${req.url}</b></p>`);
});

const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
    console.log('--------------------------------------');
    console.log(`📡 Nexus Task App rodando na porta ${PORT}`);
    console.log('--------------------------------------');
});