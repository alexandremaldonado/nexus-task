const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const app = express();

const pool = new Pool({
  connectionString: 'postgres://postgres:UPc5N5qhQi9MyRKpCzBMBzRZu11Qdo7FoujsG2xlLlf15QrPC2X7fdah1IK2ovX7@187.77.53.190:5432/postgres?sslmode=disable',
  connectionTimeoutMillis: 5000
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 1. Rota Raiz
app.get('/', (req, res) => {
    res.send('<h1>🚀 Nexus Task Server Online!</h1>');
});

// 2. Dashboard com caminho completo no SQL
app.get('/dashboard/:orgId', async (req, res) => {
    const { orgId } = req.params;
    try {
        // Note o prefixo controle_tarefas. antes das tabelas
        const orgRes = await pool.query('SELECT name FROM controle_tarefas.organizations WHERE id = $1', [orgId]);
        
        if (orgRes.rows.length === 0) {
            return res.status(404).send('<h1>Organização não encontrada</h1>');
        }

        const tasksRes = await pool.query('SELECT * FROM controle_tarefas.tasks WHERE org_id = $1 ORDER BY created_at DESC', [orgId]);
        
        res.render('dashboard', { 
            tasks: tasksRes.rows, 
            orgName: orgRes.rows[0].name,
            orgId: orgId 
        });
    } catch (err) {
        console.error("ERRO DASHBOARD:", err.message);
        res.status(500).send(`<h1>Erro Interno</h1><p>${err.message}</p>`);
    }
});

// 3. API de Time Tracking com caminho completo
app.post('/api/timer', async (req, res) => {
    const { taskId, userId, action } = req.body;
    try {
        if (action === 'start') {
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
        console.error("ERRO NO TIMER:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
    console.log(`📡 Servidor rodando na porta ${PORT}`);
});