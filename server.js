const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const app = express();

// Configuração do Pool de Conexão
const pool = new Pool({
  connectionString: 'postgres://postgres:UPc5N5qhQi9MyRKpCzBMBzRZu11Qdo7FoujsG2xlLlf15QrPC2X7fdah1IK2ovX7@187.77.53.190:5432/postgres?sslmode=disable',
  connectionTimeoutMillis: 5000
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- ROTAS DO DASHBOARD ---

app.get('/dashboard/:orgId', async (req, res) => {
    const { orgId } = req.params;
    const view = req.query.view || 'active'; // active ou done
    
    try {
        // Busca nome da organização
        const orgRes = await pool.query('SELECT name FROM controle_tarefas.organizations WHERE id = $1', [orgId]);
        if (orgRes.rows.length === 0) return res.status(404).send('Organização não encontrada');

        // Filtro de Status: Se view for 'done', mostra apenas done. Se for 'active', mostra o resto.
        const statusFilter = view === 'done' ? " = 'done'" : " != 'done'";

        // Query que traz as tarefas e a soma de segundos de todos os timers fechados
        const tasksRes = await pool.query(`
            SELECT t.*, 
            COALESCE(SUM(EXTRACT(EPOCH FROM (te.end_time - te.start_time))), 0)::INTEGER as total_seconds_tracked
            FROM controle_tarefas.tasks t
            LEFT JOIN controle_tarefas.time_entries te ON t.id = te.task_id
            WHERE t.org_id = $1 AND t.status ${statusFilter}
            GROUP BY t.id
            ORDER BY t.created_at DESC
        `, [orgId]);

        res.render('dashboard', { 
            tasks: tasksRes.rows, 
            orgName: orgRes.rows[0].name, 
            orgId: orgId,
            currentView: view
        });
    } catch (err) {
        console.error("Erro Dashboard:", err.message);
        res.status(500).send(err.message);
    }
});

// --- API DE TAREFAS ---

// Criar Nova Tarefa
app.post('/api/tasks', async (req, res) => {
    const { title, description, priority, orgId } = req.body;
    try {
        await pool.query(
            'INSERT INTO controle_tarefas.tasks (title, description, priority, org_id, status) VALUES ($1, $2, $3, $4, $5)',
            [title, description, priority || 'medium', orgId, 'backlog']
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Mudar Status Manualmente
app.post('/api/tasks/:taskId/status', async (req, res) => {
    const { status } = req.body;
    const { taskId } = req.params;
    try {
        // Se mudar para 'done', garante que qualquer timer aberto seja fechado
        if (status === 'done') {
            await pool.query('UPDATE controle_tarefas.time_entries SET end_time = NOW() WHERE task_id = $1 AND end_time IS NULL', [taskId]);
        }
        await pool.query('UPDATE controle_tarefas.tasks SET status = $1 WHERE id = $2', [status, taskId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- API DE TIME TRACKING ---

app.post('/api/timer', async (req, res) => {
    const { taskId, userId, action } = req.body;
    try {
        if (action === 'start') {
            // Inicia novo registro
            await pool.query(
                'INSERT INTO controle_tarefas.time_entries (task_id, user_id, start_time) VALUES ($1, $2, NOW())', 
                [taskId, userId]
            );
            // Muda status para 'doing' automaticamente ao dar play
            await pool.query("UPDATE controle_tarefas.tasks SET status = 'doing' WHERE id = $1 AND status = 'backlog'", [taskId]);
        } else {
            // Fecha registro aberto
            await pool.query(
                'UPDATE controle_tarefas.time_entries SET end_time = NOW() WHERE task_id = $1 AND end_time IS NULL', 
                [taskId]
            );
        }
        res.json({ success: true });
    } catch (err) {
        console.error("Erro Timer:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Inicialização
const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
    console.log(`📡 Nexus Task Backend rodando na porta ${PORT}`);
});